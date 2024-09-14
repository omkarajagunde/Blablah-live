var onTabActivatedInterval = null;

chrome.runtime.onInstalled.addListener(() => {
	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log("UPDATE_URL_ACK -- ", onTabActivatedInterval);

	if (message.action === "UPDATE_URL_ACK") {
		clearInterval(onTabActivatedInterval);
		return true; // Indicate that the response will be sent asynchronously
	}
});

// Function to get the current active tab's URL
function updateTabUrl(tabId) {
	chrome.tabs.get(tabId, (tab) => {
		if (tab && tab.url) {
			// Broadcast the updated URL to the side panel
			chrome.runtime.sendMessage({ action: "updateURL", url: tab.url });
		}
	});
}

// Listen for tab activation (when the user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
	// Get the newly active tab's ID and update the URL
	console.log("Interval created - ");

	onTabActivatedInterval = setInterval(() => {
		console.log("Interval counter - ", onTabActivatedInterval);
		updateTabUrl(activeInfo.tabId);
	}, 200);
});

// Listen for tab URL updates (when the user navigates within a tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	/**
	 * Within same tab if user navigates to internal links like
	 * on Amazon product's in SPA's user goes to different products
	 * then this onUpdated event is called
	 */
	if (changeInfo.url) {
		// If the URL changes, update the side panel with the new URL
		chrome.runtime.sendMessage({ action: "updateURL", url: changeInfo.url });
	}
});
