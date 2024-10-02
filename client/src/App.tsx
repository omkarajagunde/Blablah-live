import { useEffect, useRef, useState } from "react";
import { ChatInterface } from "./components/chat-interface";
import axios from "axios";
import { getItemFromChromeStorage, sanitizeSiteUrl, setItemInChromeStorage, ChatMessage } from "./lib/utils";
/// <reference types="chrome"/>

function App() {
	const [state, setState] = useState<{
		currentURL: string | null;
		hasMoreMessages: boolean;
		nextBookmark: string | null;
	}>({
		currentURL: "",
		hasMoreMessages: false,
		nextBookmark: ""
	});
	const [chat, setChat] = useState<ChatMessage[] | []>([]);
	const appReadyRef = useRef<boolean>(false);

	useEffect(() => {
		console.log("chat: ", chat);
	}, [chat]);

	useEffect(() => {
		// Update the displayed URL when the background script sends a new URL

		// @ts-ignore
		chrome.runtime.onMessage.addListener(async (message: { action: string; url: string; data: any | null }) => {
			// App ready to receive events
			// @ts-ignore
			if (!appReadyRef.current) chrome.runtime.sendMessage({ action: "APP_READY_TO_RECEIVE_EVENT" });
			appReadyRef.current = true;

			if (message.action === "WS_MESSAGE") {
				console.log("App:WS_MESSAGE:received :: ", message.data);

				let userId = await getItemFromChromeStorage("user_id");
				if (userId !== message.data.from.Id) {
					setChat((prevState) => [...prevState, message.data]);
				}
			}

			if (message.action === "UPDATE_URL" && message.url) {
				let url = sanitizeSiteUrl(message.url);
				setState((prevState) => ({ ...prevState, currentURL: url, hasMoreMessages: false, nextBookmark: "" }));
				// @ts-ignore

				// // @ts-ignore
				// let port = chrome.runtime.connect({ name: "mySidePanel" });

				// // Trigger the disconnect explicitly when side panel is closed
				// window.addEventListener("beforeunload", () => {
				// 	port.disconnect();
				// });
				setChat([]);
				await registerUser(url);
				await getOldMessages(url);
			}

			return true;
		});

		console.log("Im hit");
	}, []);

	const registerUser = async (url: string) => {
		// Register the user

		let userId = await getItemFromChromeStorage("user_id");

		try {
			const headers: { [key: string]: string } = {};
			if (userId) {
				// @ts-ignore
				headers["X-Id"] = userId;
				await axios.post(
					`https://blablah-live-production.up.railway.app/update/user?IsOnline=true&SiteId=${url}`,
					{},
					{ headers }
				);
			}

			if (!userId) {
				let response = await axios.post(`https://blablah-live-production.up.railway.app/register?SiteId=${url}`);
				setItemInChromeStorage("user_id", response.data.id);
				setItemInChromeStorage("profile", JSON.parse(response.data.data));
				// Create new socket connection...
			}

			// @ts-ignore
			chrome.runtime.sendMessage({ action: "START_WS_SESSION" });
		} catch (error) {
			console.log(error);
		}
	};

	const getOldMessages = async (url: string) => {
		// Get messages
		let userId = await getItemFromChromeStorage("user_id");
		const headers: { [key: string]: string } = {};
		if (userId) {
			// @ts-ignore
			headers["X-Id"] = userId;
			axios
				.get(
					`https://blablah-live-production.up.railway.app/messages?SiteId=${url || state.currentURL}&Bookmark=${
						state.nextBookmark
					}`,
					{
						headers
					}
				)
				.then((resp) => {
					console.log("resp - ", resp.data.data);
					let chatArray: any = [];
					if (Array.isArray(resp.data.data)) {
						resp.data.data.forEach((msg: any) => {
							chatArray.push({
								_id: msg.Id,
								created_at: msg.CreatedAt,
								updated_at: msg.UpdatedAt,
								from: msg.from,
								flagged: msg.flagged,
								channel: msg.ChannelId,
								message: msg.Message,
								to: msg.to,
								reactions: msg.reactions
							});
						});

						setChat([...chatArray.reverse(), ...chat]);
						setState((prevState) => ({
							...prevState,
							hasMoreMessages: resp.data.hasMore,
							nextBookmark: resp.data.nextBookmark
						}));
					}
				})
				.catch(console.error);
		}
	};

	return (
		<ChatInterface
			currentURL={state.currentURL}
			chat={chat}
			setChat={setChat}
			hasMoreMessages={state.hasMoreMessages}
			handleLoadMessages={getOldMessages}
		/>
	);
}

export default App;
