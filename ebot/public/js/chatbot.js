document.addEventListener('DOMContentLoaded', function () {
    // Inject the chatbot widget into the body
    var chatbotHTML = `
    <!-- Include Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
  
    <!-- Chatbot Widget HTML -->
    <div id="chatbot-widget">
      <!-- Chatbot Toggle Button -->
      <button id="chatbot-toggle" class="chatbot-toggle-button" aria-label="Open Chat">
        <i class="fas fa-comment-dots"></i>
      </button>
      <!-- Chatbot Container -->
      <div class="chatbot-container" id="chatbot-container">
        <!-- Chatbot Header -->
        <div class="chatbot-header">
          <div class="header-left">
            <div class="assistant-avatar">
              <!-- Replace with your own avatar image -->
              <img src="/assets/plantbot/images/assistant-avatar.png" alt="Assistant Avatar">
              <div class="online-indicator"></div>
            </div>
            <div class="assistant-info">
              <h3>Plante Bot</h3>
              <p>Online</p>
            </div>
          </div>
          <div class="header-right">
            <button id="chatbot-minimize" class="chatbot-header-button" aria-label="Minimize Chat">
              <i class="fas fa-window-minimize"></i>
            </button>
            <button id="chatbot-close" class="chatbot-header-button" aria-label="Close Chat">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        <!-- Chat Window -->
        <div id="chat-window" data-has-welcome="false">
          <!-- Chat messages go here -->
        </div>
        <!-- Input Container -->
        <form id="chat-form" class="input-container">
          <!-- Hidden Image Input -->
          <input type="file" id="image-input" accept="image/*" style="display: none;" />
          <!-- Image Upload Button -->
          <button type="button" id="image-button" class="image-button" aria-label="Upload Image">
            <i class="fas fa-image"></i>
          </button>
          <!-- Text Input -->
          <input type="text" id="user-input" placeholder="Ask me anything..." autocomplete="off" />
          <!-- Voice Input Button -->
          <button type="button" id="voice-button" class="voice-button" aria-label="Voice Input">
            <i class="fas fa-microphone-alt"></i>
          </button>
          <!-- Send Button -->
          <button type="submit" id="send-button" class="send-button" aria-label="Send Message">
            <i class="fas fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
    `;
  
    // Append the chatbot widget to the body
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  
    // Elements
    var sendButton = document.getElementById('send-button');
    var voiceButton = document.getElementById('voice-button');
    var imageButton = document.getElementById('image-button');
    var imageInput = document.getElementById('image-input');
    var userInputField = document.getElementById('user-input');
    var chatWindow = document.getElementById('chat-window');
    var chatbotToggle = document.getElementById('chatbot-toggle');
    var chatbotContainer = document.getElementById('chatbot-container');
    var chatbotClose = document.getElementById('chatbot-close');
    var chatbotMinimize = document.getElementById('chatbot-minimize');
    var chatForm = document.getElementById('chat-form');
  
    var isMinimized = false;
    var isRecording = false;
    var isTyping = false;
  
    // Toggle chatbot visibility
    chatbotToggle.onclick = function () {
      chatbotContainer.classList.add('active');
      chatbotToggle.style.display = 'none';
      isMinimized = false;
  
      // Display welcome message only once
      if (chatWindow.dataset.hasWelcome === 'false') {
        showBotMessage(
          "Hello! I'm your friendly chatbot. How can I assist you today?"
        );
        chatWindow.dataset.hasWelcome = 'true';
      }
    };
  
    // Close chatbot
    chatbotClose.onclick = function () {
      chatbotContainer.classList.remove('active');
      chatbotToggle.style.display = 'block';
    };
  
    // Minimize chatbot
    chatbotMinimize.onclick = function () {
      if (!isMinimized) {
        chatbotContainer.classList.add('minimized');
        isMinimized = true;
        chatbotMinimize.innerHTML = '<i class="fas fa-window-maximize"></i>';
        chatbotMinimize.setAttribute('aria-label', 'Maximize Chat');
      } else {
        chatbotContainer.classList.remove('minimized');
        isMinimized = false;
        chatbotMinimize.innerHTML = '<i class="fas fa-window-minimize"></i>';
        chatbotMinimize.setAttribute('aria-label', 'Minimize Chat');
      }
    };
  
    // Form submission (send text message)
    chatForm.addEventListener('submit', function (e) {
      e.preventDefault();
      sendMessage();
    });
  
    // Image upload button
    imageButton.onclick = function () {
      imageInput.click();
    };
  
    // Handle image selection
    imageInput.onchange = function () {
      var file = imageInput.files[0];
      if (file) {
        displayUserImage(file);
        sendImage(file);
        // Reset the input
        imageInput.value = '';
      }
    };
  
    // Voice input button
    voiceButton.onclick = function () {
      startVoiceRecognition();
    };
  
    // ------------------------------------------------------------------
    // Helper Functions
    // ------------------------------------------------------------------
  
    function sendMessage() {
      var userInput = userInputField.value.trim();
      if (userInput === '') return;
  
      showUserMessage(userInput);
      userInputField.value = '';
      chatWindow.scrollTop = chatWindow.scrollHeight;
  
      // Show typing indicator
      showTypingIndicator();
  
      // Call your ERPNext backend method
      frappe.call({
        method: 'plantbot.api.get_bot_response',
        args: {
          'user_message': userInput
        },
        callback: function (r) {
          hideTypingIndicator();
          if (r.message) {
            showBotMessage(r.message);
          }
        },
        error: function () {
          hideTypingIndicator();
          showBotMessage("Sorry, an error occurred.");
        }
      });
    }
  
    function sendImage(file) {
      showTypingIndicator();
  
      var formData = new FormData();
      formData.append('image', file);
  
      $.ajax({
        url: '/api/method/plantbot.api.process_image',
        type: 'POST',
        data: formData,
        headers: {
          'X-Frappe-CSRF-Token': frappe.csrf_token
        },
        processData: false,
        contentType: false,
        success: function (r) {
          hideTypingIndicator();
          if (r.message) {
            showBotMessage(r.message);
          }
        },
        error: function () {
          hideTypingIndicator();
          showBotMessage("Sorry, an error occurred while processing the image.");
        }
      });
    }
  
    function displayUserImage(file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var userMessage = document.createElement('div');
        userMessage.className = 'user-message message';
  
        var img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '200px';
        img.style.borderRadius = '10px';
  
        userMessage.appendChild(img);
        chatWindow.appendChild(userMessage);
        appendTimestamp(userMessage);
        chatWindow.scrollTop = chatWindow.scrollHeight;
      };
      reader.readAsDataURL(file);
    }
  
    function showUserMessage(text) {
      var userMessage = document.createElement('div');
      userMessage.className = 'user-message message';
      userMessage.innerHTML = text;
      chatWindow.appendChild(userMessage);
      appendTimestamp(userMessage);
    }
  
    function showBotMessage(text) {
      var botMessage = document.createElement('div');
      botMessage.className = 'bot-message message';
      botMessage.innerHTML = text;
      chatWindow.appendChild(botMessage);
      appendTimestamp(botMessage);
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  
    function appendTimestamp(messageElement) {
      var timestamp = document.createElement('span');
      timestamp.className = 'timestamp';
      timestamp.textContent = formatTime(new Date());
      messageElement.appendChild(timestamp);
    }
  
    function formatTime(date) {
      var hours = date.getHours();
      var minutes = date.getMinutes();
      var ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      if (minutes < 10) {
        minutes = '0' + minutes;
      }
      return hours + ':' + minutes + ' ' + ampm;
    }
  
    function showTypingIndicator() {
      if (isTyping) return;
      isTyping = true;
      var typingIndicator = document.createElement('div');
      typingIndicator.className = 'typing-indicator';
      typingIndicator.id = 'typing-indicator';
      typingIndicator.innerHTML = '<i class="fas fa-ellipsis-h"></i> Bot is typing...';
      chatWindow.appendChild(typingIndicator);
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  
    function hideTypingIndicator() {
      isTyping = false;
      var indicator = document.getElementById('typing-indicator');
      if (indicator) {
        indicator.remove();
      }
    }
  
    // ------------------------------------------------------------------
    // Voice Recognition (Web Speech API)
    // ------------------------------------------------------------------
    function startVoiceRecognition() {
      if (!('webkitSpeechRecognition' in window)) {
        alert('Your browser does not support voice recognition. Please use Google Chrome.');
        return;
      }
  
      if (isRecording) {
        recognition.stop();
        isRecording = false;
        voiceButton.innerHTML = '<i class="fas fa-microphone-alt"></i>';
        voiceButton.classList.remove('is-recording');
        return;
      }
  
      var recognition = new webkitSpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
  
      recognition.start();
      isRecording = true;
      voiceButton.innerHTML = '<i class="fas fa-stop-circle"></i>';
      voiceButton.classList.add('is-recording');
  
      recognition.onstart = function () {
        console.log('Voice recognition started.');
      };
  
      recognition.onresult = function (event) {
        var transcript = event.results[0][0].transcript;
        userInputField.value = transcript;
        sendMessage();
      };
  
      recognition.onerror = function () {
        console.error('Voice recognition error.');
        stopRecordingUI();
      };
  
      recognition.onend = function () {
        stopRecordingUI();
      };
  
      function stopRecordingUI() {
        if (isRecording) {
          isRecording = false;
          voiceButton.innerHTML = '<i class="fas fa-microphone-alt"></i>';
          voiceButton.classList.remove('is-recording');
        }
      }
    }
  });