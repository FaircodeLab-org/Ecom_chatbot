document.addEventListener('DOMContentLoaded', function () {
  // Inject the chatbot widget into the body
  var orderStatusPrompt = false;
  var supportChatActive = false; // true when in support mode
  var supportChatSession = null; // stores the current session ID for support chat
  var image_context = ""; 
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
                          <img src="/assets/ebot/images/assistant-avatar.png" alt="Assistant Avatar">
                          <div class="online-indicator"></div>
                      </div>
                      <div class="assistant-info">
                          <h3 style="color: #FFB300; font-weight: bold; letter-spacing: 1px; margin: 0;">Plante Bot</h3>
                          <p style="color: #4CAF50; font-size: 14px; margin: 3px 0 0;">Online</p>
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
                  <input type="file" id="image-input" accept="image/*" style="display: none;" />
                  <button type="button" id="image-button" class="image-button" aria-label="Upload Image">
                      <i class="fas fa-image"></i>
                  </button>
                  <input type="text" id="user-input" placeholder="Ask me anything..." autocomplete="off" />
                  <button type="button" id="voice-button" class="voice-button" aria-label="Voice Input">
                      <i class="fas fa-microphone-alt"></i>
                  </button>
                  <button type="submit" id="send-button" class="send-button" aria-label="Send Message">
                      <i class="fas fa-paper-plane"></i>
                  </button>
              </form>
          </div>
      </div>`;

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
 
  frappe.realtime.on("new_support_chat", function(data) {
      console.log("Chatbot realtime event received:", data);
      if (supportChatActive && supportChatSession && data.session_id === supportChatSession) {
          showBotMessage(data.sender + ": " + data.message);
      }
  });

  // Toggle chatbot visibility
  chatbotToggle.onclick = function () {
      chatbotContainer.classList.add('active');
      chatbotToggle.style.display = 'none';
      isMinimized = false;

      // Display welcome message only once
      if (chatWindow.dataset.hasWelcome === 'false') {
        showBotMessage("Hello! I'm your friendly chatbot. How can I assist you today?");
        initChatbotMenu();
        
    //   if (chatWindow.dataset.hasWelcome === 'false') {
    //       showBotMessage("Hello! I'm your friendly chatbot. How can I assist you today?");
          
    //       var menuHTML = `
    //           <div id="chatbot-menu" style="margin-top: 10px; text-align: center; display: flex; justify-content: center; gap: 10px;">
    //               <button id="menu-order-status" style="padding: 8px 16px; margin: 5px; border: none; background-color: #4CAF50; color: white; border-radius: 4px; cursor: pointer;">
    //                   Check Order Status
    //               </button>
    //               <button id="menu-support" style="padding: 8px 16px; margin: 5px; border: none; background-color: #2196F3; color: white; border-radius: 4px; cursor: pointer;">
    //                   Customer Support
    //               </button>
    //           </div>`;
          
        //   chatWindow.insertAdjacentHTML('beforeend', menuHTML);
        //   chatWindow.dataset.hasWelcome = 'true';
        //   var original_menu = document.getElementById('chatbot-menu').outerHTML;

        //   document.getElementById('menu-order-status').addEventListener('click', function() {
        //       showBotMessage("Sure, please enter your order number (e.g., SO-0001).");
        //       orderStatusPrompt = true;
        //       userInputField.focus();
        //   });
          
        //   document.getElementById('menu-support').addEventListener('click', function () {
        //     // Reset any pending orderStatusPrompt flag
        //     orderStatusPrompt = false;
        
        //     // Clear the chat window and display support contact details
        //     chatWindow.innerHTML = "";
        
        //     // Display support contact info
        //     showBotMessage("For customer support, please contact us at support@example.com or call +91-XXXXXXXXXX.");
        
        //     // Append two buttons: "Live Chat Now" and "Go Back"
        //     var supportButtonsHTML = `
        //         <div id="support-options" style="text-align:center; margin-top:10px;">
        //             <button id="live-chat-now" style="padding:8px 16px; margin:5px; border:none; background-color:#2196F3; color:#fff; border-radius:4px; cursor:pointer;">
        //                 Live Chat Now
        //             </button>
        //             <button id="go-back" style="padding:8px 16px; margin:5px; border:none; background-color:#f44336; color:#fff; border-radius:4px; cursor:pointer;">
        //                 Go Back
        //             </button>
        //         </div>
        //     `;
        //     chatWindow.insertAdjacentHTML('beforeend', supportButtonsHTML);
        
        //     // Add event listener for "Go Back" button
        //     document.getElementById('go-back').addEventListener('click', function () {
        //         // Restore the original menu
        //         chatWindow.innerHTML = "";
        //         chatWindow.insertAdjacentHTML('beforeend', original_menu);
                
        //         // Reset the dataset flag so the menu is considered shown again
        //         chatWindow.dataset.hasWelcome = 'true';
        //         supportChatActive = false; // Optionally, turn off support mode
        //     });
        
        //     // Add event listener for "Live Chat Now" button
        //     document.getElementById('live-chat-now').addEventListener('click', function () {
        //         // Now initiate live support
        //         supportChatActive = true;
        //         chatWindow.innerHTML = "";
        //         showBotMessage("Connecting you to support... You are now in live chat mode.");
        
        //         if (!supportChatSession) {
        //             // Call support chat API to create a session
        //             frappe.call({
        //                 method: 'ebot.api.send_support_chat',
        //                 args: { message: "Chat initiated", session_id: null },
        //                 callback: function (r) {
        //                     if (r.message) {
        //                         supportChatSession = r.message;
        //                         console.log("Support chat session initiated:", supportChatSession);
        //                         loadSupportMessages(); // Call fallback polling once immediately
        //                     }
        //                 }
        //             });
        //         } else {
        //             loadSupportMessages();
        //         }
        //     });
        // });
        function initChatbotMenu() {
            var menuHTML = `
                <div id="chatbot-menu" style="margin-top: 10px; text-align: center; display: flex; justify-content: center; gap: 10px;">
                    <button id="menu-order-status" style="padding: 8px 16px; margin: 5px; border: none; background-color: #4CAF50; color: white; border-radius: 4px; cursor: pointer;">
                        Check Order Status
                    </button>
                    <button id="menu-support" style="padding: 8px 16px; margin: 5px; border: none; background-color: #2196F3; color: white; border-radius: 4px; cursor: pointer;">
                        Customer Support
                    </button>
                </div>
            `;
            
            chatWindow.insertAdjacentHTML('beforeend', menuHTML);
            chatWindow.dataset.hasWelcome = 'true';
            
            // Attach event listeners for the menu buttons:
            document.getElementById('menu-order-status').addEventListener('click', function() {
                showBotMessage("Sure, please enter your order number (e.g., SO-0001).");
                orderStatusPrompt = true;
                userInputField.focus();
            });
            
            // Customer Support event (without immediately starting live chat):
            document.getElementById('menu-support').addEventListener('click', function() {
                // Reset any pending order status prompt:
                orderStatusPrompt = false;
                
                // Clear window and show support contact info and options:
                chatWindow.innerHTML = "";
                showBotMessage("For customer support, please contact us at cs@plantonorganic.com or call +91-8129333277.");
                
                // Append two buttons: "Live Chat Now" and "Go Back"
                var supportButtonsHTML = `
                    <div id="support-options" style="text-align:center; margin-top:10px;">
                        <button id="live-chat-now" style="padding:8px 16px; margin:5px; border:none; background-color:#2196F3; color:#fff; border-radius:4px; cursor:pointer;">
                            Live Chat Now
                        </button>
                        <button id="go-back" style="padding:8px 16px; margin:5px; border:none; background-color:#f44336; color:#fff; border-radius:4px; cursor:pointer;">
                            Go Back
                        </button>
                    </div>
                `;
                
                chatWindow.insertAdjacentHTML('beforeend', supportButtonsHTML);
                
                // "Go Back" button event
                document.getElementById('go-back').addEventListener('click', function() {
                    // Clear the window and reinitialize the original menu:
                    chatWindow.innerHTML = "";
                    initChatbotMenu();
                    supportChatActive = false; // Optional: disable support mode until chosen again
                });
                
                // "Live Chat Now" button event: now actually start live chat
                document.getElementById('live-chat-now').addEventListener('click', function() {
                    supportChatActive = true;
                    chatWindow.innerHTML = "";
                    showBotMessage("Connecting you to support... You are now in live chat mode.");
                    
                    // Initiate the support session if not available
                    if (!supportChatSession) {
                        frappe.call({
                            method: 'ebot.api.send_support_chat',
                            args: { message: "Chat initiated", session_id: null },
                            callback: function(r) {
                                if (r.message) {
                                    supportChatSession = r.message;
                                    console.log("Support chat session initiated:", supportChatSession);
                                    loadSupportMessages();
                                }
                            }
                        });
                    } else {
                        loadSupportMessages();
                    }
                });
            });
        }
        

          function loadSupportMessages() {
              if (supportChatActive && supportChatSession) {
                  frappe.call({
                      method: 'ebot.api.get_support_chat_messages',
                      args: { session_id: supportChatSession },
                      callback: function(r) {
                          chatWindow.innerHTML = "";
                          if (r.message && r.message.length > 0) {
                              r.message.forEach(function(msg) {
                                  if (msg.sender === frappe.session.user) {
                                      showUserMessage(msg.message);
                                  } else {
                                      showBotMessage(msg.sender + ": " + msg.message);
                                  }
                              });
                          }
                      }
                  });
              }
          }

          // Poll for new messages every 5 seconds
          setInterval(loadSupportMessages, 5000);
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

      // === Order Status Processing ===
      if (orderStatusPrompt) {
          orderStatusPrompt = false;
          showUserMessage(userInput);
          userInputField.value = '';
          chatWindow.scrollTop = chatWindow.scrollHeight;

          showTypingIndicator();
          frappe.call({
              method: 'ebot.api.get_order_status',
              args: { order_id: userInput },
              callback: function(r) {
                  hideTypingIndicator();
                  if (r.message) {
                      showBotMessage(r.message);
                  } else {
                      showBotMessage("Sorry, no status found for order " + userInput);
                  }
              },
              error: function() {
                  hideTypingIndicator();
                  showBotMessage("Sorry, there was an error retrieving your order status.");
              }
          });
          return;
      }

      // === Support Chat Processing ===
      if (supportChatActive) {
          showUserMessage(userInput);
          userInputField.value = '';
          chatWindow.scrollTop = chatWindow.scrollHeight;

          frappe.call({
              method: 'ebot.api.send_support_chat',
              args: { 
                  message: userInput,
                  session_id: supportChatSession  // May be null initially
              },
              callback: function(r) {
                  if (r.message && !supportChatSession) {
                      supportChatSession = r.message;
                  }
                  showBotMessage("Message sent to support. Please wait for a reply.");

                  // Add "Close Chat" button if not present
                //   if (!document.getElementById('close-support-chat')) {
                //       var closeChatHTML = `
                //           <button id="close-support-chat" style="padding: 6px 12px; margin-top: 10px; border: none; background-color: #f44336; color: white; border-radius: 4px; cursor: pointer;">
                //               Close Chat
                //           </button>`;
                //       chatWindow.insertAdjacentHTML('beforeend', closeChatHTML);

                //       document.getElementById('close-support-chat').addEventListener('click', function() {
                //           frappe.call({
                //               method: 'ebot.api.close_support_chat',
                //               args: { session_id: supportChatSession },
                //               callback: function(r) {
                //                   showBotMessage("Your support session has been closed.");
                //                   supportChatActive = false;
                //                   supportChatSession = null;
                //                   document.getElementById('close-support-chat').remove();
                //               },
                //               error: function() {
                //                   showBotMessage("Sorry, an error occurred while closing the support chat.");
                //               }
                //           });
                //       });
                //   }
                if (!document.getElementById('close-support-chat')) {
                    var closeChatHTML = `
                        <button id="close-support-chat" style="padding: 6px 12px; margin-top: 10px; border: none; 
                            background-color: #f44336; color: white; border-radius: 4px; cursor: pointer;">
                            Close Chat
                        </button>`;
                
                    chatWindow.insertAdjacentHTML('beforeend', closeChatHTML);
                
                    document.getElementById('close-support-chat').addEventListener('click', function () {
                        frappe.call({
                            method: 'ebot.api.close_support_chat',
                            args: { session_id: supportChatSession },
                            callback: function (r) {
                                // Notify user that support chat is closed
                                showBotMessage("Your support session has been closed.");
                
                                // Reset support mode
                                supportChatActive = false;
                                supportChatSession = null;
                
                                // Remove close chat button
                                document.getElementById('close-support-chat').remove();
                
                                // Add a Return to Chat Menu button so the user can go back without refreshing
                                var returnButtonHTML = `
                                    <button id="return-to-menu" style="padding: 6px 12px; margin-top: 10px; border: none; 
                                        background-color: #2196F3; color: white; border-radius: 4px; cursor: pointer;">
                                        Return to Chat Menu
                                    </button>`;
                
                                chatWindow.insertAdjacentHTML('beforeend', returnButtonHTML);
                
                                document.getElementById('return-to-menu').addEventListener('click', function () {
                                    // Clear the chat window and reinitialize the main chatbot menu
                                    chatWindow.innerHTML = "";
                                    chatWindow.dataset.hasWelcome = 'false';
                                    initChatbotMenu();
                                });
                            },
                            error: function () {
                                showBotMessage("Sorry, an error occurred while closing the support chat.");
                            }
                        });
                    });
                }
                
              },
              error: function() {
                  showBotMessage("Sorry, an error occurred while sending your message.");
              }
          });
          return;
      }

      // === Default Chatbot Processing ===
    //   showUserMessage(userInput);
    //   userInputField.value = '';
    //   chatWindow.scrollTop = chatWindow.scrollHeight;

    //   showTypingIndicator();
    //   frappe.call({
    //       method: 'ebot.api.get_bot_response',
    //       args: { user_message: userInput },
    //       callback: function(r) {
    //           hideTypingIndicator();
    //           if (r.message) {
    //               showBotMessage(r.message);
    //           }
    //       },
    //       error: function() {
    //           hideTypingIndicator();
    //           showBotMessage("Sorry, an error occurred.");
    //       }
    //   });
    // === Default Chatbot Processing ===
// If an image was recently uploaded and analyzed, prepend its context
// if (image_context !== "") {
//     // Combine image context with the user's follow-up question
//     userInput = image_context + "\nFollow-up Question: " + userInput;
//     // Clear the image_context so it is used only once
//     image_context = "";
// }


    // if (image_context !== "") {
    //     userInput = "Image analysis: " + image_context + "\nFollow-up question: " + userInput;
    //     // Then clear the stored analysis so it is used only once:
    //     image_context = "";
    //     }
    // showUserMessage(userInput);
    // userInputField.value = '';
    // chatWindow.scrollTop = chatWindow.scrollHeight;

    // showTypingIndicator();
    // frappe.call({
    //     method: 'ebot.api.get_bot_response',
    //     args: { user_message: userInput },
    //     callback: function(r) {
    //         hideTypingIndicator();
    //         if (r.message) {
    //             showBotMessage(r.message);
    //         }
    //     },
    //     error: function() {
    //         hideTypingIndicator();
    //         showBotMessage("Sorry, an error occurred.");
    //     }
    // });
    // === Default Chatbot Processing ===
// If an image was recently uploaded, use the stored analysis as the final answer
if (image_context !== "") {
    // Option 1: If you want to completely ignore the follow-up text:
    showUserMessage(userInput);  // show user's follow-up message
    userInputField.value = '';
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    // Then, output the stored analysis directly:
    showBotMessage(image_context);
    // Clear the stored image analysis so it isn’t reused:
    image_context = "";
    // Return early so that no further API call is made:
    return;
}

// Otherwise, process normally:
showUserMessage(userInput);
userInputField.value = '';
chatWindow.scrollTop = chatWindow.scrollHeight;

showTypingIndicator();
frappe.call({
    method: 'ebot.api.get_bot_response',
    args: { user_message: userInput },
    callback: function(r) {
        hideTypingIndicator();
        if (r.message) {
            showBotMessage(r.message);
        }
    },
    error: function() {
        hideTypingIndicator();
        showBotMessage("Sorry, an error occurred.");
    }
});
  }

//   function sendImage(file) {
//       showTypingIndicator();
//       var formData = new FormData();
//       formData.append('image', file);

//       $.ajax({
//           url: '/api/method/ebot.api.process_image',
//           type: 'POST',
//           data: formData,
//           headers: {
//               'X-Frappe-CSRF-Token': frappe.csrf_token
//           },
//           processData: false,
//           contentType: false,
//           success: function (r) {
//               hideTypingIndicator();
//               if (r.message) {
//                   showBotMessage(r.message);
//               }
//           },
//           error: function () {
//               hideTypingIndicator();
//               showBotMessage("Sorry, an error occurred while processing the image.");
//           }
//       });
//   }

function sendImage(file) {
    showTypingIndicator();
    var formData = new FormData();
    formData.append('image', file);

    if (supportChatActive) {
        // In support mode, call our custom upload_support_image method
        $.ajax({
            url: '/api/method/ebot.api.upload_support_image',
            type: 'POST',
            data: formData,
            headers: {
                'X-Frappe-CSRF-Token': frappe.csrf_token
            },
            processData: false,
            contentType: false,
            success: function (r) {
                hideTypingIndicator();
                if (r.message && r.message !== "No image provided.") {
                    // Build an inline HTML image tag
                    var image_html = '<img src="' + r.message + '" style="max-width:200px; border-radius:8px;"/>';

                    // Send the image as a support chat message
                    frappe.call({
                        method: 'ebot.api.send_support_chat',
                        args: {
                            message: image_html,
                            session_id: supportChatSession
                        },
                        callback: function (response) {
                            console.log("Support image sent:", response);
                        }
                    });

                    // Optionally, display the image locally in the chatbot window
                    showBotMessage(image_html);
                } else {
                    showBotMessage("No image was returned.");
                }
            },
            error: function () {
                hideTypingIndicator();
                showBotMessage("Sorry, an error occurred while uploading the image.");
            }
        });
    } else {
        // Non-support mode processing using process_image
        $.ajax({
            url: '/api/method/ebot.api.process_image',
            type: 'POST',
            data: formData,
            headers: {
                'X-Frappe-CSRF-Token': frappe.csrf_token
            },
            processData: false,
            contentType: false,
            success: function (r) {
                hideTypingIndicator();
                if (r.message && r.message.analysis) {
                    // Instead of immediately displaying the answer,
                    // store it in image_context and prompt for follow-up.
                    // image_context = r.message;
                    
                    
                    image_context = r.message.analysis;
                    // Display a special message prompting the user:
                    showBotMessage("Thank you for uploading the image. What would you like to know about it?");
                    
                    // Optionally, clear the input field:
                    userInputField.value = "";
                    // showBotMessage(r.message.analysis);
                }
                else {
                    showBotMessage("An error occurred while processing the image.");
                    }
            },
            error: function () {
                hideTypingIndicator();
                showBotMessage("Sorry, an error occurred while processing the image.");
            }
        });
    }
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
      if (minutes < 10) minutes = '0' + minutes;
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
      if (indicator) indicator.remove();
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