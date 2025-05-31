// Add debug logging
console.log('Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === "getSelectedText") {
    const selection = window.getSelection().toString();
    console.log('Selected text:', selection);
    
    // Always send a response, even if empty
    sendResponse({ text: selection });
    return true; // Keep the message channel open for async response
  }
});
