var onTabActivatedInterval = null;
var panelClosedCalled = false;
var socket = null;
var activeTabId = null;
var currentURL = "";
var socketInterval = null;

function sanitizeSiteUrl(url) {
	const site = new URL(url);
	if (url.includes("youtube")) {
		const videoId = site.searchParams.get("v");
		if (videoId) return `${site.protocol}//${site.host}${site.pathname}?v=${videoId}`;
	}

	if (url.includes("drive.google.com")) return `${site.protocol}//${site.host}`;

	if (url.includes("amazon")) {
	}
	return `${site.protocol}//${site.host}${site.pathname}`;
}

function deepParse(obj) {
	if (typeof obj === "string") {
		try {
			// Try to parse the string as JSON
			const parsed = JSON.parse(obj);
			// Recursively parse the parsed object in case there are nested strings to parse
			return deepParse(parsed);
		} catch (e) {
			// If parsing fails, return the string as it is
			return obj;
		}
	} else if (typeof obj === "object" && obj !== null) {
		// Recursively process each key in the object or array
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				obj[key] = deepParse(obj[key]);
			}
		}
	}
	return obj;
}

function openWebSocket(user_id) {
	if (socket) {
		socket.close(1000, "Normal closure");
	}

	socket = new WebSocket(
		`ws://blablah-live-production.up.railway.app/receive/${user_id}?SiteId=${sanitizeSiteUrl(currentURL)}`
	);

	socket.onopen = function (event) {
		console.log("WebSocket connection opened");
		clearInterval(socketInterval);
		if (socket && socket.readyState && socket.readyState === WebSocket.OPEN)
			socketInterval = setInterval(() => {
				socket.send("ping");
			}, 5000);
	};

	socket.onmessage = function (event) {
		// Broadcast to other parts of the extension
		chrome.runtime.sendMessage({ action: "WS_MESSAGE", data: deepParse(event.data) });
	};

	socket.onerror = function (error) {
		console.error("WebSocket error:", error);
	};

	socket.onclose = function (event) {
		console.log("WebSocket closed. Reconnecting...", event);
		socket = null;
		if (!event.wasClean) {
			setTimeout(() => {
				openWebSocket(user_id);
			}, 5000); // Attempt to reconnect after 5 seconds
		}
	};
}

chrome.runtime.onConnect.addListener((port) => {
	console.log("Port connected with name:", port.name);

	if (port.name === "mySidePanel") {
		panelClosedCalled = false;
		console.log("Side panel opened");

		port.onDisconnect.addListener(() => {
			console.log("Side panel closed");

			if (!panelClosedCalled) {
				panelClosedCalled = true;
				chrome.storage.local.get(["user_id"], (result) => {
					fetch("https://blablah-live-production.up.railway.app/update/user?IsOnline=false", {
						method: "POST",
						headers: { "X-Id": result["user_id"] }
					})
						.then((response) => {
							if (!response.ok) {
								throw new Error(`Network response was not ok: ${response.statusText}`);
							}
							return response.json(); // Or handle the response as needed
						})
						.then((data) => {
							console.log("Fetch successful: ", data);
						})
						.catch((error) => {
							console.error("Fetch failed: ", error);
						});
				});
			}
		});
	}
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "GET_URL") {
		updateTabUrl();
	}
	if (message.action === "APP_READY_TO_RECEIVE_EVENT") {
		console.log("App ready");
		updateTabUrl();
	}

	if (message.action === "START_WS_SESSION") {
		chrome.storage.local.get(["user_id"], (result) => {
			openWebSocket(result["user_id"]);
		});
	}
});

// Function to get the current active tab's URL
function updateTabUrl() {
	chrome.tabs.get(activeTabId, (tab) => {
		if (tab && tab.url) {
			currentURL = tab.url;
			// Broadcast the updated URL to the side panel
			chrome.runtime.sendMessage({ action: "UPDATE_URL", url: tab.url });
		}
	});
}

// Listen for tab activation (when the user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
	// Get the newly active tab's ID and update the URL
	activeTabId = activeInfo.tabId;
	updateTabUrl();
});

// Listen for tab URL updates (when the user navigates within a tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	/**
	 * Within same tab if user navigates to internal links like
	 * on Amazon product's in SPA's user goes to different products
	 * then this onUpdated event is called
	 */
	if (changeInfo.url) {
		currentURL = changeInfo.url;
		// If the URL changes, update the side panel with the new URL
		chrome.runtime.sendMessage({ action: "UPDATE_URL", url: changeInfo.url });
	}
});

chrome.runtime.onInstalled.addListener(() => {
	chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
