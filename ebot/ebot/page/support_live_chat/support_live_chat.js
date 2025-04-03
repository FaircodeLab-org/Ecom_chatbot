frappe.pages['support_live_chat'].on_page_load = function (wrapper) {
    // Create the page using ERPNext's page layout builder
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Support Live Chat',
        single_column: true
    });

    // Append the rendered HTML template
    $(frappe.render_template("support_live_chat", {})).appendTo(page.main);
    console.log("support_live_chat.js loaded.");

   
    // Retrieve the session ID from the route; if missing, prompt the support agent.
    // DO NOT auto-generate a new session here – the agent must input the session ID from the chatbot.
    var routeParts = frappe.get_route();
    var currentSessionId = (routeParts.length > 1 && routeParts[1].trim() !== "")
        ? routeParts[1]
        : prompt("Enter THE support session ID (the same as the one given to the chatbot):");

    if (!currentSessionId) {
        console.error("No valid session ID entered. Cannot join chat.");
        return;
    }
    console.log("Support Agent Joining Session: " + currentSessionId);

    // Get element references
    var chatWindow = document.getElementById('support-chat-window');
    var chatInput = document.getElementById('support-chat-input');
    var sendButton = document.getElementById('support-chat-send');
    var closeButton = document.getElementById('support-chat-close');

    if (!chatWindow || !chatInput || !sendButton || !closeButton) {
        console.error("Essential HTML elements missing. Check support_live_chat.html.");
        return;
    }

    // Clear chat window so that only messages from the current session are shown
    chatWindow.innerHTML = "";

    // Function to append messages
    function appendMessage(sender, message) {
        var messageDiv = document.createElement("div");
        messageDiv.style.marginBottom = "5px";
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // Load previous messages for the current session
    function loadMessages() {
        frappe.call({
            method: 'ebot.api.get_support_chat_messages',
            args: { session_id: currentSessionId },
            callback: function (r) {
                chatWindow.innerHTML = "";
                if (r.message && r.message.length) {
                    r.message.forEach(function (msg) {
                        var senderLabel = (msg.sender === frappe.session.user) ? "You" : msg.sender;
                        appendMessage(senderLabel, msg.message);
                    });
                } else {
                    appendMessage("System", "No previous messages.");
                }
            }
        });
    }
    loadMessages();

    // Fallback: refresh messages every 10 seconds
    setInterval(loadMessages, 10000);

    // Realtime subscription for new messages
    frappe.realtime.on("new_support_chat", function (data) {
        console.log("Realtime event on support page:", data);
        // Filter events to the current session
        if (data.session_id === currentSessionId) {
            var senderLabel = (data.sender === frappe.session.user) ? "You" : data.sender;
            appendMessage(senderLabel, data.message);
        }
    });

    // Send button event
    sendButton.addEventListener('click', function () {
        var message = chatInput.value.trim();
        if (!message) return;

        // Log current session ID when sending message
        console.log("Sending message for session: " + currentSessionId);
        appendMessage("You", message);
        chatInput.value = "";

        frappe.call({
            method: 'ebot.api.send_support_chat',
            args: {
                message: message,
                session_id: currentSessionId
            },
            callback: function (r) {
                // Optional: Log callback response
                console.log("send_support_chat response:", r);
            }
        });
    });

    
    frappe.realtime.on("close_support_chat", function (data) {
        console.log("Realtime close event received:", data);
        if (currentSessionId && String(data.session_id) === String(currentSessionId)) {
            appendMessage("System", "This support session has been closed.");
            chatInput.disabled = true;
            sendButton.disabled = true;
        }
    });

    // Close chat event
    closeButton.addEventListener('click', function () {
        frappe.call({
            method: 'ebot.api.close_support_chat',
            args: { session_id: currentSessionId },
            callback: function (r) {
                appendMessage("System", "This support session has been closed.");
                chatInput.disabled = true;
                sendButton.disabled = true;
            }
        });
    });
};