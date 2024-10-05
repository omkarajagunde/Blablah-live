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
		chat: ChatMessage[];
		updateType: string;
		isChatLoading: boolean;
	}>({
		currentURL: "",
		hasMoreMessages: false,
		nextBookmark: "",
		chat: [],
		updateType: "",
		isChatLoading: true
	});
	const appReadyRef = useRef<boolean>(false);

	useEffect(() => {
		console.log("chat: ", state.chat);
	}, [state.chat]);

	useEffect(() => {
		//request the current URL from the background script
		console.log(" requested URL from background script");
		// @ts-ignore
		chrome.runtime.sendMessage({ action: "GET_URL" });
	}, []);

	const handleUpdateMsg = (payload: ChatMessage) => {
		let newArray = state.chat.map((msg) => {
			if (msg._id === payload._id) {
				let obj: any = {};
				if (Object.keys(payload.reactions).length > 0) {
					Object.entries(payload.reactions).forEach((entry: any) => {
						obj[entry[0]] = entry[1].length;
					});
				}
				msg = {
					...msg,
					...payload,
					reactions: obj
				};
			}
			return msg;
		});
		setState((prevState) => ({ ...prevState, chat: newArray, updateType: "update" }));
	};

	const handleListener = async (message: { action: string; url: string; data: any | null }) => {
		// App ready to receive events

		// @ts-ignore
		if (!appReadyRef.current) chrome.runtime.sendMessage({ action: "APP_READY_TO_RECEIVE_EVENT" });
		appReadyRef.current = true;

		if (message.action === "WS_MESSAGE") {
			console.log("App:WS_MESSAGE:received :: ", message.data);

			let userId = await getItemFromChromeStorage("user_id");
			let type = message.data.type;
			let payload: ChatMessage = message.data.doc;
			if (type === "insert") {
				if (userId !== payload.from.Id) {
					setState((prevState) => ({ ...prevState, chat: [...prevState.chat, payload], updateType: "insertDown" }));
				}
			}

			if (type === "update") {
				handleUpdateMsg(payload);
			}
		}

		if (message.action === "UPDATE_URL" && message.url) {
			let url = sanitizeSiteUrl(message.url);
			setState((prevState) => ({
				...prevState,
				currentURL: url,
				hasMoreMessages: false,
				nextBookmark: "",
				chat: [],
				isChatLoading: true
			}));

			// @ts-ignore
			let port = chrome.runtime.connect({ name: "mySidePanel" });
			// Trigger the disconnect explicitly when side panel is closed
			window.addEventListener("beforeunload", () => {
				port.disconnect();
			});
			await registerUser(url);
			await getOldMessages(url, true);
		}

		return true;
	};

	useEffect(() => {
		// Update the displayed URL when the background script sends a new URL

		// @ts-ignore
		chrome.runtime.onMessage.addListener(handleListener);
		return () => {
			// @ts-ignore
			chrome.runtime.onMessage.removeListener(handleListener);
		};
	}, [state]);

	const setChat = (msg: ChatMessage) => {
		setState((prevState) => ({ ...prevState, chat: [...prevState.chat, msg] }));
	};

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

	const getOldMessages = async (url: string, isBookmark: boolean = false) => {
		// Get messages
		let userId = await getItemFromChromeStorage("user_id");
		const headers: { [key: string]: string } = {};
		if (userId) {
			// @ts-ignore
			headers["X-Id"] = userId;
			axios
				.get(
					`https://blablah-live-production.up.railway.app/messages?SiteId=${url || state.currentURL}&Bookmark=${
						isBookmark ? "" : state.nextBookmark
					}`,
					{
						headers
					}
				)
				.then((resp) => {
					let chatArray: ChatMessage[] = [];
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

						chatArray = chatArray.map((msg: ChatMessage) => {
							let obj: any = {};
							if (Object.keys(msg.reactions).length > 0) {
								Object.entries(msg.reactions).forEach((entry: any) => {
									obj[entry[0]] = entry[1].length;
								});
							}

							msg.reactions = obj;
							return msg;
						});

						if (!isBookmark) {
							chatArray = [...chatArray, ...state.chat];
						}

						chatArray.sort(
							(a: ChatMessage, b: ChatMessage) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
						);

						chatArray = chatArray.filter(
							(item: ChatMessage, index, self) => index === self.findIndex((i) => i._id === item._id)
						);

						setState((prevState) => ({
							...prevState,
							hasMoreMessages: resp.data.hasMore,
							nextBookmark: resp.data.nextBookmark,
							chat: JSON.parse(JSON.stringify(chatArray)),
							updateType: "insertUp",
							isChatLoading: false
						}));
					} else {
						setState((prevState) => ({
							...prevState,
							hasMoreMessages: false,
							nextBookmark: "",
							chat: [],
							updateType: "insertUp",
							isChatLoading: false
						}));
					}
				})
				.catch(console.error);
		}
	};

	return (
		<ChatInterface
			currentURL={state.currentURL}
			chat={state.chat}
			setChat={setChat}
			updateType={state.updateType}
			hasMoreMessages={state.hasMoreMessages}
			handleLoadMessages={getOldMessages}
			isChatLoading={state.isChatLoading}
		/>
	);
}

export default App;
