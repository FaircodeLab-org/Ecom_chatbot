from __future__ import unicode_literals
import frappe
import openai
import requests
import base64
import json
import threading
import numpy as np
import os
import time

# Import helper functions from faqs.py
from ebot.ebot.doctype.faqs.faqs import get_openai_api_key, get_embedding
# from frappe.utils.file_manager import get_file_data_from_form
from frappe.utils import nowdate
from datetime import datetime, timedelta

@frappe.whitelist(allow_guest=True)
def get_personalized_recommendations(user_id):
    """
    Fetches user's purchase history and recommends products based on that history.
    """
    # Fetch user's purchase history
    purchase_history = frappe.get_all('Sales Invoice Item', 
                                     filters={'parent': ['in', frappe.get_all('Sales Invoice', 
                                                                              filters={'customer': user_id, 
                                                                                       'status': ['!=', 'Draft']}, 
                                                                              pluck='name')]},
                                     fields=['item_code', 'qty'],
                                     limit=10)  # Limit to last 10 purchases for simplicity

    # Fetch items from the history
    items = [item['item_code'] for item in purchase_history]

    # Simple recommendation logic: recommend items similar to what the user has bought
    # Here we're assuming a simple rule-based approach. For more sophisticated recommendations, 
    # you might want to use machine learning models or more complex algorithms.
    recommended_items = []
    for item_code in items:
        # Find similar items (this is a placeholder logic, you'd need to define what 'similar' means)
        similar_items = frappe.get_all('Item', 
                                       filters={'item_group': frappe.get_value('Item', item_code, 'item_group')},
                                       fields=['name', 'item_name', 'thumbnail', 'route'],
                                       limit=3)  # Recommend 3 similar items per purchased item
        recommended_items.extend(similar_items)

    # Remove duplicates and limit to 5 recommendations
    unique_recommendations = list({v['name']: v for v in recommended_items}.values())[:5]

    # Build response
    response = "Based on your purchase history, here are some recommendations for you:\n"
    for item in unique_recommendations:
        route_url = f"/{item.route}" if item.route and not item.route.startswith("/") else item.route or "#"
        response += f"- <a href='{route_url}' target='_blank'>{item.item_name}</a>\n"

    return response


# Global variables
faq_embeddings = []
embeddings_initialized = False
embeddings_lock = threading.Lock()

def initialize_faq_embeddings():
    """
    Initializes embeddings for FAQs by loading them from the database.
    """
    global faq_embeddings
    global embeddings_initialized

    with embeddings_lock:
        if embeddings_initialized:
            # Embeddings have already been initialized
            return

        try:
            # Fetch all FAQs with their embeddings
            faqs = frappe.get_all('FAQS', fields=['name', 'question', 'answer', 'embedding'])

            # Load embeddings for each FAQ
            faq_embeddings = []
            for faq in faqs:
                if faq['embedding']:
                    try:
                        # Load the embedding from JSON string
                        embedding = json.loads(faq['embedding'])
                        faq_embeddings.append({
                            'name': faq['name'],
                            'question': faq['question'],
                            'answer': faq['answer'],
                            'embedding': embedding
                        })
                        frappe.logger().debug(f"Loaded embedding for FAQ '{faq['name']}': First 5 values: {embedding[:5]}...")
                    except Exception as e:
                        frappe.log_error(f"Error loading embedding for FAQ {faq['name']}: {str(e)}", "Chatbot Embedding Error")
                else:
                    # If embedding is missing, compute and save it
                    openai_api_key = get_openai_api_key()
                    if not openai_api_key:
                        frappe.log_error("OpenAI API key is not set.", "Chatbot Error")
                        continue

                    embedding = get_embedding(faq['question'])
                    # Save the embedding in the database
                    frappe.db.set_value('FAQS', faq['name'], 'embedding', json.dumps(embedding))
                    frappe.db.commit()
                    faq_embeddings.append({
                        'name': faq['name'],
                        'question': faq['question'],
                        'answer': faq['answer'],
                        'embedding': embedding
                    })
            embeddings_initialized = True  # Mark embeddings as initialized
        except Exception as e:
            frappe.log_error(f"Error initializing embeddings: {str(e)}", "Chatbot Embedding Initialization Error")

@frappe.whitelist(allow_guest=True)
def get_bot_response(user_message):
    """
    Public method to get the bot's response.
    """
    # Ensure embeddings are initialized
    if not embeddings_initialized:
        initialize_faq_embeddings()

    response = process_message(user_message)
    return response

def process_message(user_message):
    """
    Processes the user's message and returns the bot's response.
    """
    user_message = user_message.strip()
    product_results = search_products(user_message)
    if product_results:
        return build_product_response(product_results)
    
    # Search the knowledge base for an exact match
    faq_answer = search_faq(user_message)
    if faq_answer:
        return faq_answer

    # If no exact match, use embeddings to find relevant FAQs
    relevant_faqs = get_relevant_faqs(user_message, top_k=5)
    gpt_answer = get_gpt_interpreted_response(user_message, relevant_faqs)
    return gpt_answer

COMMON_STOPWORDS = {
    "can", "i", "some", "the", "store", "products", "your", "my",
    "a", "an", "of", "to", "and", "for", "need","some", "me", "you", "get", "want",
    "in", "on", "we", "am", "are", "is", "it", "ask", "at", "please",
    "sir", "any", "how", "this", "that", "those", "these", "do",
    "does", "did", "let", "us", "from", "could", "would", "should",
    "like", "thing", "things", "there"
}

def search_products(user_query):
    """
    Searches tabWebsite Item (wi) that are published,
    joined with tabItem (i) and tabItem Price (ip) for price_list_rate.
    Removes common stopwords, then does an AND-based whole-word match so that
    all tokens must appear as distinct words in wi.item_name or wi.description.
    """

    # 1) Tokenize user query & remove stopwords
    raw_tokens = user_query.lower().split()
    tokens = [t for t in raw_tokens if t not in COMMON_STOPWORDS]

    # If all words were stopwords, return no items (or you can fallback to OR logic here)
    if not tokens:
        return []

    # 2) Build AND clauses for each token using REGEXP for whole word matching
    and_clauses = []
    values = {}

    for idx, token in enumerate(tokens):
        key = f"token_{idx}"
        # Use REGEXP with word boundaries so that it won’t match substrings of other words.
        clause = f"LOWER(wi.item_name) REGEXP %({key})s"
        and_clauses.append(clause)
        # The word boundaries ([[:<:]] and [[:>:]]) indicate the beginning and end of a word.
        values[key] = f"[[:<:]]{token}[[:>:]]"

    and_condition = " AND ".join(and_clauses)

    # 3) Build the final SQL with DISTINCT to avoid duplicates
    sql = f"""
        SELECT DISTINCT
            wi.name,
            wi.item_name AS title,
            wi.thumbnail,
            wi.route,
            ip.price_list_rate
        FROM `tabWebsite Item` wi
        JOIN `tabItem` i ON i.item_code = wi.item_code
        JOIN `tabItem Price` ip ON ip.item_code = i.item_code
        WHERE wi.published = 1
        AND ( {and_condition} )
        /* Optionally filter on price_list, e.g.:
        AND ip.price_list = 'Standard Selling' */
    """

    # 4) Execute with token-based values
    items = frappe.db.sql(sql, values, as_dict=True)
    return items




def build_product_response(items):
    if not items:
        return "Sorry, I couldn’t find any matching products."

    response_lines = []

    for item in items:
        # 1) Build product page URL
        route_url = f"/{item.route}" if item.route and not item.route.startswith("/") else item.route or "#"

        # 2) Product name link
        product_name_html = f"""
        <a href="{route_url}" target="_blank" style="text-decoration: none; color: #2e7d32;">
            <h4 style="margin: 0;">{item.title}</h4>
        </a>
        """

        # 3) Image (thumbnail) link
        image_html = ""
        if item.thumbnail:
            image_html = f"""
            <a href="{route_url}" target="_blank">
                <img src="{item.thumbnail}" 
                    alt="{item.title}" 
                    style="max-width: 200px; border-radius: 8px; margin-top: 5px;">
            </a>
            """

        # # 4) Description
        # desc = item.description or "No description available."
        # desc_html = f"<p style='margin: 5px 0;'>{desc}</p>"

        # 5) Display price
        # 'price_list_rate' from tabItem Price
        price_html = ""
        if item.get("price_list_rate") is not None:
            # For example, show with currency
            price_html = f"<p><b>Price:</b> {item.price_list_rate:.2f} Rs</p>"

        # 6) Add to Cart (assuming a route like /cart?item_code=...)
        item_code = item.name  # or i.item_code if you included it in the SELECT
        add_to_cart_url = f"/cart?item_code={item_code}&quantity=1"

        add_to_cart_html = f"""
        <a href="{add_to_cart_url}" target="_blank"
        style="display: inline-block; padding: 6px 10px; margin-top: 5px;
                border: 1px solid #2e7d32; background-color: #66bb6a; color: #fff;
                text-decoration: none; border-radius: 4px;">
            Add to Cart
        </a>
        """
          
        # 7) Combine everything
        product_html = f"""
        <div style="margin-bottom: 15px;">
            {product_name_html}
            
            {image_html}
            {price_html}
            {add_to_cart_html}
        </div>
        """
        response_lines.append(product_html)

    return "".join(response_lines)

def search_faq(user_message):
    """
    Searches for an exact match in the FAQs.
    """
    faqs = frappe.get_all('FAQS', fields=['question', 'answer'])
    for faq in faqs:
        if user_message.lower() == faq['question'].lower():
            return faq['answer']
    return None

def get_embedding(text, model="text-embedding-ada-002"):
    """
    Generates an embedding for the given text using the specified OpenAI model.
    """
    # Ensure OpenAI API key is set
    if not openai.api_key:
        openai_api_key = get_openai_api_key()
        if not openai_api_key:
            frappe.log_error("OpenAI API key is not set.", "Chatbot Error")
            return []

        openai.api_key = openai_api_key

    try:
        response = openai.Embedding.create(
            input=[text],
            model=model
        )
        embedding = response['data'][0]['embedding']
        return embedding
    except Exception as e:
        frappe.log_error(f"Error generating embedding: {str(e)}", "Chatbot Embedding Error")
        return []

def cosine_similarity(a, b):
    """
    Computes the cosine similarity between two vectors.
    """
    a = np.array(a)
    b = np.array(b)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def get_relevant_faqs(user_message, top_k=5):
    global faq_embeddings

    if not faq_embeddings:
        frappe.log_error("FAQ embeddings are not initialized.", "Chatbot Error")
        return []

    # Generate embedding for user message
    user_embedding = get_embedding(user_message)
    if not user_embedding:
        frappe.log_error("Failed to get embedding for user message.", "Chatbot Error")
        return []
    frappe.logger().debug(f"Generated embedding for user message: First 5 values: {user_embedding[:5]}...")

    # Compute cosine similarity between user message and FAQs
    similarities = []
    for faq in faq_embeddings:
        try:
            sim = cosine_similarity(user_embedding, faq['embedding'])
            similarities.append((sim, faq))
            # Log each similarity score
            frappe.logger().debug(f"Similarity between user message and FAQ '{faq['name']}': {sim}")
        except Exception as e:
            frappe.log_error(f"Error computing similarity for FAQ {faq['name']}: {str(e)}", "Chatbot Similarity Error")

    # Sort FAQs by similarity score in descending order
    similarities.sort(key=lambda x: x[0], reverse=True)

    MIN_SIMILARITY_THRESHOLD = 0.0  # You can adjust this value
    relevant_faqs = [faq for sim, faq in similarities[:top_k] if sim >= MIN_SIMILARITY_THRESHOLD]

    # Log the selected relevant FAQs
    frappe.logger().debug(f"Top {len(relevant_faqs)} relevant FAQs selected.")
    return relevant_faqs

def get_gpt_interpreted_response(user_message, relevant_faqs):
    """
    Uses OpenAI's ChatCompletion API to generate a response based on relevant FAQs.
    """
    # Ensure OpenAI API key is set
    if not openai.api_key:
        openai_api_key = get_openai_api_key()
        if not openai_api_key:
            frappe.log_error("OpenAI API key is not set.", "Chatbot Error")
            return "I'm sorry, I cannot process your request at the moment."

        openai.api_key = openai_api_key

    # Prepare the FAQ prompt with relevant FAQs
    if relevant_faqs:
        faq_prompt = "\n".join([f"Q: {faq['question']}\nA: {faq['answer']}" for faq in relevant_faqs])
    else:
        faq_prompt = ""

    # Incorporate company description, vision, and mission into the system prompt
    company_description = """
    Plantrich Agritech Private Limited, nestled in the heart of Kerala, India, is a beacon of sustainability and innovation in organic agribusiness. Specializing in premium organic spice extractions, spice powders, spice blends, green coffee beans, cocoa beans, coconut oil, and herbs, Plantrich brings the authentic flavours and rich aroma of the Western Ghats to tables across the globe.

    With a mission deeply rooted in sustainability and fairness, Plantrich empowers over 5,000 farmers from South India, fostering ethical farming practices and promoting a fair trade system that strengthens local economies. Certified by USDA NOP, EU Organic, Fairtrade, Natureland, and Rainforest Alliance, every product reflects our unwavering commitment to quality, health, and environmental protection.

    Plantrich has established a strong global presence in India, Europe, US, and the Middle East. Guided by a vision of healthy living and environmental stewardship, Plantrich is redefining how the world experiences organic food.

    Our Ethical Business Model allows all parties to participate in a fully traceable and fair trade chain, from our farmers to our factory and on to our customers. Everyone has a part to play in supporting a sustainable environment.

    Vision:
    To empower farmers, promote sustainable living, and deliver organic riches to the global market.

    Mission:
    To bring the finest organic products to the world while supporting sustainable farming practices, fair trade, and environmental stewardship.
    """

    system_prompt = f"""
    You are a helpful assistant for Plantrich Agritech Private Limited. Use the following information to answer the user's questions in a clear and friendly manner.

    Company Description:
    {company_description}

    FAQs:
    {faq_prompt}
    """

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4-1106-preview",  # Make sure this model is available to you
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_message.strip()}
            ],
            max_tokens=150,
            temperature=0.7,
        )
        return response.choices[0].message['content'].strip()
    except Exception as e:
        frappe.log_error(f"OpenAI API Error: {str(e)}", "Chatbot Response Error")
        return "I'm sorry, I'm having trouble responding right now. Please try again later."
    











@frappe.whitelist(allow_guest=True)
def upload_support_image():
    """
    Uploads an image from a support chat message by creating a new File document and returns its public URL.
    """
    # Check if an image was provided in the request
    if 'image' not in frappe.request.files:
        return "No image provided."

    image_file = frappe.request.files['image']
    filedata = image_file.read()
    file_name = image_file.filename

    # Create a new File document manually
    file_doc = frappe.new_doc("File")
    file_doc.file_name = file_name
    file_doc.content = filedata
    file_doc.is_private = 0  # Make file public

    # Optionally, you may set additional fields such as attached_to_doctype if needed:
    # file_doc.attached_to_doctype = "Support Chat Message"

    try:
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return file_doc.file_url
    except Exception as e:
        frappe.log_error(f"Error in upload_support_image: {str(e)}", "Support Image Upload Error")
        return "Failed to upload image."





@frappe.whitelist(allow_guest=True)
def process_image():
    OPENAI_API_KEY = frappe.local.conf.get("openai_api_key", None)
    OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"

    if 'image' not in frappe.request.files:
        return {"error": "No image provided."}

    image_file = frappe.request.files['image']
    image_base64 = base64.b64encode(image_file.read()).decode('utf-8')

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "gpt-4-turbo",
        "messages": [
            {"role": "system", "content": "You are an AI that analyzes images and provides insights."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Analyze this image and describe its contents."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]
            }
        ],
        "max_tokens": 500
    }

    try:
        response = requests.post(OPENAI_ENDPOINT, json=payload, headers=headers)
        response_data = response.json()

        if "error" in response_data:
            error_message = response_data["error"].get("message", "Unknown error")
            frappe.log_error(f"OpenAI Error: {error_message[:120]}", "OpenAI API Debug")
            return {"error": error_message}

        if response.ok:
            result = response.json()
            # Extract the AI response:
            analysis = result['choices'][0]['message']['content'].strip()
            # Return only the analysis
            return {"analysis": analysis}
        else:
            error_message = f"OpenAI API Error {response.status_code}: {response.text}"
            frappe.log_error(error_message, "OpenAI Image Analysis Error")
            return {"error": "An error occurred while processing the image. Please try again later."}

    except requests.exceptions.RequestException as e:
        frappe.log_error(f"Request Exception: {str(e)[:120]}", "OpenAI API Debug")
        return {"error": "Failed to connect to OpenAI API."}

















@frappe.whitelist(allow_guest=True)
def get_order_status(order_id):
    """
    Given an order number (order_id), this function retrieves the Sales Order
    and returns a formatted status message.
    """
    try:
        # Retrieve the Sales Order. Optionally check permissions here.
        order = frappe.get_doc("Sales Order", order_id)
        if not order:
            return f"Order {order_id} was not found."

    #     # Retrieve useful fields (Adjust field names if needed)
    #     status = order.status  # Example: "Draft", "Submitted", etc.
    #     order_date = order.transaction_date
    #     customer = order.customer

    #     msg = f"Order {order_id} for {customer} (dated {order_date}) is currently: {status}."

    #     if order.get("tracking_no"):
    #         msg += f" Your tracking number is {order.tracking_no}."
            
    #     return msg
       # Retrieve standard fields
        status = order.status  # e.g., "Draft", "Submitted", etc.
        order_date = order.transaction_date
        customer = order.customer

        # Retrieve custom fields (adjust field names as per your customization)
        custom_del_date = order.get("custom_estimated_delievry_date")
        custom_current_status = order.get("custom_current_status")
        tracking_no = order.get("custom_tracking_no")

        # Construct a basic message
        msg = f"Order {order_id} for {customer} (dated {order_date}) is currently: {status}.\n"

        # Append additional custom fields if available
        if tracking_no:
            msg += f"Tracking Number: {tracking_no}\n"
        if custom_del_date:
            msg += f"Estimated Delivery Date: {custom_del_date}\n"
        if custom_current_status:
            msg += f"Current Status: {custom_current_status}\n"

        # Append ordered items information
        items = frappe.get_all("Sales Order Item", filters={"parent": order_id}, fields=["item_code", "item_name", "qty"])
        if items:
            msg += "\nItems in this order:\n"
            for item in items:
                msg += f" - {item.item_name} (Code: {item.item_code}), Quantity: {item.qty}\n"

        return msg




    except Exception as e:
        frappe.log_error(f"Error fetching order status for {order_id}: {str(e)}", "Order Status Error")
        return f"Sorry, we couldn’t retrieve the status for order {order_id}."

@frappe.whitelist(allow_guest=True)
def get_customer_support():
    """
    Returns customer support details.
    """
    # You can fetch this from settings or just return a static message.
    support_message = (
        "For customer support, please call 123-456-7890 or "
        "email info@faircodelab.com. "
        "Our support team is available 9am-5pm, Monday through Saturday."
    )
    return support_message

@frappe.whitelist(allow_guest=True)
def send_support_chat(message, session_id=None, sender=None):
    """
    Creates a new Support Chat Message record.
    If no sender is provided, it defaults to frappe.session.user.
    The receiver is set to a fixed support agent (for record purposes only).
    If no session_id is provided (i.e., for the first message), a new session is generated.
    Returns the session_id on success.
    """
    try:
        if not sender:
            sender = frappe.session.user

        # For record-keeping only:
        receiver = "support@yourdomain.com"

        if not session_id:
            session_id = f"{sender}-{int(time.time())}"

        chat = frappe.get_doc({
            "doctype": "Support Chat Message",
            "subject": "Support Chat",
            "chat_session_id": session_id,
            "message": message,
            "sender": sender,
            "receiver": receiver,
            "status": "open"
        })
        chat.insert(ignore_permissions=True)
        frappe.db.commit()

        # Publish real-time event to all subscribers (omit "user" parameter)
        frappe.publish_realtime(
            "new_support_chat",
            {
                "session_id": session_id,
                "message": message,
                "sender": sender
            }
        )

        return session_id

    except Exception as e:
        frappe.log_error(f"Error in send_support_chat: {str(e)}", "Support Chat Error")
        return "Failed to send message."

@frappe.whitelist(allow_guest=True)
def get_support_chat_messages(session_id=None):
    """
    Retrieves support chat messages.
    Filters by session_id if provided; otherwise, falls back to filtering by sender.
    """
    try:
        filters = {"chat_session_id": session_id} if session_id else {"sender": frappe.session.user}
        messages = frappe.get_all(
            "Support Chat Message",
            filters=filters,
            fields=["sender", "message", "creation"],
            order_by="creation asc"
        )
        return messages

    except Exception as e:
        frappe.log_error(f"Error fetching support messages: {str(e)}", "Support Chat Error")
        return []

@frappe.whitelist(allow_guest=True)
def close_support_chat(session_id):
    """
    Closes a support chat session by updating its status to 'closed'. Also broadcasts a realtime event so that all clients
    disable chat for that session.
    """
    try:
        frappe.db.set_value("Support Chat Message", {"chat_session_id": session_id}, "status", "closed")
        frappe.db.commit()

        # Publish a realtime event to notify all connected clients that this session is closed.
        frappe.publish_realtime("close_support_chat", {"session_id": session_id})
        
        return "Support chat closed."
    except Exception as e:
        frappe.log_error(f"Error closing support chat for {session_id}: {str(e)}", "Support Chat Error")
        return "Failed to close support chat."