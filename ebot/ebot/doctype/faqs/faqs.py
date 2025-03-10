# File: plantbot/plantbot/doctype/faqs/faqs.py

# Import necessary modules
import frappe
from frappe.model.document import Document
import openai
import os
import json

class FAQS(Document):
    def on_save(self):
        # Compute and store the embedding when the FAQ is saved
        # Get the OpenAI API key
        openai_api_key = get_openai_api_key()
        if not openai_api_key:
            frappe.log_error("OpenAI API key not found.", "Chatbot Error")
            return

        openai.api_key = openai_api_key

        # Generate embedding for the question
        try:
            embedding = get_embedding(self.question)
            # Store the embedding as a JSON string
            self.embedding = json.dumps(embedding)
            # Save changes to the database
            self.db_update()
        except Exception as e:
            frappe.log_error(f"Error generating embedding for FAQ {self.name}: {str(e)}", "Chatbot Embedding Error")

def get_openai_api_key():
    """
    Retrieves the OpenAI API key from site_config.json or environment variables.
    """
    # Try to get API key from site config
    openai_api_key = frappe.local.conf.get("openai_api_key", None)
    if not openai_api_key:
        # Try to get API key from environment variable
        openai_api_key = os.environ.get('OPENAI_API_KEY')
    if not openai_api_key:
        frappe.log_error("OpenAI API key not found.", "Chatbot Error")
    return openai_api_key

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