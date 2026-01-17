export default defineContentScript({
  matches: ['*://*.polymarket.com/*'],
  main() {
    const checkAndOpenPopup = () => {
      if (window.location.pathname.startsWith('/event/')) {
        browser.runtime.sendMessage({ action: 'openPopup' });
      }
    };

    checkAndOpenPopup();

    // monitor URL changes for polymarket's SPA
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        checkAndOpenPopup();
      }
    });

    observer.observe(document, { subtree: true, childList: true });

    // Also listen to popstate events (back/forward navigation)
    window.addEventListener('popstate', checkAndOpenPopup);

    // Listen for requests from the popup
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'getPageInfo') {
        if (window.location.pathname.startsWith('/event/')) {
          sendResponse({ url: window.location.href });
        } else {
          sendResponse({ url: null });
        }
      }
      return true;
    });
  },
});
