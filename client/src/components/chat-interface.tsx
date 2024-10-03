"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Sun,
	Moon,
	Send,
	SmilePlus,
	Settings,
	Flag,
	Reply,
	X,
	ChevronDown,
	ChevronUp,
	ArrowUp,
	ArrowDown,
	AlertCircle
} from "lucide-react";
import axios from "axios";
import { ChatMessage, getItemFromChromeStorage } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";

const emojis = ["😀", "😂", "😍", "🤔", "👍", "👎", "❤️", "🎉", "🔥", "👀"];
const emojiNames = [
	"grinning",
	"joy",
	"heart_eyes",
	"thinking",
	"thumbsup",
	"thumbsdown",
	"heart",
	"tada",
	"fire",
	"eyes"
];

const giphyStickers = [
	"https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtZ2JiZDR0a3lvNjhwbzNyNHBxcnhxc3Vxb2Q1aXUyZ2QyamtociZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/26BRv0ThflsHCqDrG/giphy.gif",
	"https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDd1Nm5xYnBwNzVmOWJsdnBnOXg3bXBnNXl6Ynl4d3kydWJvNmYyaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7aCTfyhYawdOXcFW/giphy.gif",
	"https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXh6ZWkxZTlkMzFvMWF0NnFxOHFxbXFmNHd3NXV2bG01aHIyeGpmNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlGsmOxGDberRJe/giphy.gif"
];

export function ChatInterface({
	currentURL,
	chat,
	setChat,
	hasMoreMessages,
	handleLoadMessages,
	updateType
}: {
	currentURL: string | null;
	chat: ChatMessage[];
	setChat: Function;
	hasMoreMessages: boolean;
	handleLoadMessages: Function;
	updateType: string;
}) {
	const [darkMode, setDarkMode] = useState(true);
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
	const [message, setMessage] = useState("");
	const [showEmojiSuggestions, setShowEmojiSuggestions] = useState(false);
	const [pinnedExpanded, setPinnedExpanded] = useState(true);
	const [showScrollToBottom, setShowScrollToBottom] = useState(true);
	const [hoveredMessage, setHoveredMessage] = useState(null);
	const [alert, setAlert] = useState<{ flag: boolean; message: string; type: string }>({
		flag: false,
		message: "",
		type: "success"
	});
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const chatRef = useRef<HTMLDivElement>(null);

	const toggleDarkMode = () => setDarkMode(!darkMode);

	useEffect(() => {
		if (textareaRef.current && message.length > 0) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [message]);

	useEffect(() => {
		chatRef.current?.addEventListener("scroll", () => {
			if (chatRef.current) {
				const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
				setShowScrollToBottom(scrollTop < scrollHeight - clientHeight - 50);
			}
		});
	}, []);

	useEffect(() => {
		if (updateType === "insertUp") scrollToBottom("up");
		if (updateType === "insertDown") scrollToBottom("down");
	}, [chat]);

	const handleMessageChange = (e: any) => {
		setMessage(e.target.value);
		setShowEmojiSuggestions(e.target.value.endsWith(":"));
	};

	const insertEmoji = (emoji: any) => {
		setMessage(message + emoji);
		setShowEmojiSuggestions(false);
	};
	const scrollToBottom = (dir = "down") => {
		if (chatRef.current) {
			if (dir === "down") {
				chatRef.current.scrollTop = chatRef.current.scrollHeight;
			}

			if (dir === "up") {
				chatRef.current.scrollTop = 0;
			}
		}
	};

	const sendMessage = async () => {
		let userId = await getItemFromChromeStorage("user_id");
		let myProfile = await getItemFromChromeStorage("profile");
		try {
			const headers: { [key: string]: string } = {};
			if (userId && message.length > 0) {
				// @ts-ignore
				headers["X-Id"] = userId;
				let messageObj = {
					Timestamp: new Date().toISOString(),
					// @ts-ignore
					From: { Id: String(userId), Username: myProfile["Username"] },
					To: "",
					Reactions: {},
					Flagged: [],
					Message: message,
					ChannelId: currentURL
				};
				let response = await axios.post(
					`https://blablah-live-production.up.railway.app/send?SiteId=${currentURL}`,
					{ ...messageObj },
					{ headers }
				);
				setChat({
					_id: response.data.MsgId,
					created_at: messageObj.Timestamp,
					updated_at: messageObj.Timestamp,
					from: messageObj.From,
					flagged: messageObj.Flagged,
					channel: messageObj.ChannelId,
					message: messageObj.Message,
					to: messageObj.To,
					reactions: messageObj.Reactions
				});
				setMessage("");
				scrollToBottom("down");
			}
		} catch (error) {
			console.log(error);
			// @ts-ignore
			if (error?.response?.status === 429) {
				setAlert((prevState: any) => ({
					...prevState,
					flag: true,
					message: "To many requests, slow down!...",
					type: "error"
				}));
			}
		}
	};

	const loadMoreMessages = () => {
		handleLoadMessages();
	};

	const handleReaction = async (emoji: string) => {
		let userId = await getItemFromChromeStorage("user_id");
		try {
			setHoveredMessage(null);
			const headers: { [key: string]: string } = {};
			if (userId && hoveredMessage) {
				// @ts-ignore
				headers["X-Id"] = userId;
				let response = await axios.post(
					`https://blablah-live-production.up.railway.app/react/${hoveredMessage}`,
					{ emoji },
					{ headers }
				);
				console.log("AddReactions response -- ", response);
			}
		} catch (error) {
			console.log("AddReactions error -- ", error);
		}
	};

	return (
		<div className={`flex flex-col h-screen w-full ${darkMode ? "dark" : ""}`}>
			<div className="flex flex-col h-full bg-background text-foreground border border-border rounded-lg overflow-hidden">
				<header className="flex flex-col border-b border-border p-2 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium truncate">{currentURL}</span>
						<div className="flex items-center justify-end space-x-2">
							<div className="flex items-center">
								<span className="relative flex h-3 w-3 mr-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
								</span>
								<span className="text-sm font-medium">5 users</span>
							</div>

							<Button variant="ghost" size="icon">
								<Settings className="h-4 w-4" />
							</Button>

							<Button variant="ghost" size="icon" onClick={toggleDarkMode}>
								{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
							</Button>
						</div>
					</div>
				</header>

				<Collapsible open={pinnedExpanded} onOpenChange={setPinnedExpanded} className="border-b border-border">
					<CollapsibleTrigger asChild>
						<Button variant="ghost" size="sm" className="flex w-full justify-between p-2">
							<span>Pinned Comments</span>
							{pinnedExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="p-2 bg-secondary/50">
						{pinnedExpanded ? (
							<>
								<p className="text-sm">Are you liking the plugin? Provide feedback - </p>
							</>
						) : (
							<p className="text-sm truncate">Important: Team meeting at 3 PM today!</p>
						)}
					</CollapsibleContent>
				</Collapsible>

				<div className="flex-1 overflow-y-auto space-y-4 px-4 my-2 scroll-smooth" ref={chatRef}>
					{hasMoreMessages && (
						<div className="flex justify-center py-2 bg-gradient-to-b from-background to-transparent">
							<Button variant="secondary" size="sm" className="rounded-full shadow-md" onClick={loadMoreMessages}>
								<ArrowUp className="h-4 w-4 mr-2" />
								Load more messages
							</Button>
						</div>
					)}

					{chat.map((msg: any) => (
						<div
							key={msg._id}
							id={msg._id}
							className="flex items-start space-x-2 group relative rounded-lg"
							onMouseEnter={() => setHoveredMessage(msg._id)}
							onMouseLeave={() => setHoveredMessage(null)}
						>
							<img
								className="w-10 h-10 rounded-full bg-muted"
								src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${msg.from.Username}&radius=50&backgroundColor=0a5b83,1c799f,69d2e7,f1f4dc,f88c49,b6e3f4,c0aede&translateY=15&randomizeIds=true`}
							></img>
							<div className="flex-1">
								<div className="rounded-lg">
									<div className="flex items-center justify-between">
										<span className="font-semibold">{msg.from.Username}</span>
										<span className="text-xs text-muted-foreground">
											{new Date(msg.updated_at).toLocaleTimeString()}
										</span>
									</div>
									<p className="mt-1 text-sm break-all">{msg.message}</p>
									{msg.sticker && <img src={msg.sticker} alt="Sticker" className="mt-2 max-w-[200px] rounded" />}
								</div>
								<div className="flex items-center flex-wrap">
									{Object.entries(msg.reactions).map(([emoji, count]: [any, any]) => (
										<Button
											key={emoji}
											variant="secondary"
											size="sm"
											className="text-xs mr-1 mt-1"
											onClick={() => handleReaction(emoji)}
										>
											{emoji} {count}
										</Button>
									))}
								</div>
							</div>
							{hoveredMessage === msg._id && (
								<div className="absolute right-0 bottom-2 flex items-center space-x-1 bg-background/80 backdrop-blur-sm rounded p-1">
									<Popover>
										<PopoverTrigger asChild>
											<Button variant="ghost" size="sm">
												<SmilePlus className="h-4 w-4" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-full p-0">
											<div className="grid grid-cols-5 gap-2 p-2">
												{emojis.map((emoji) => (
													<Button
														key={emoji}
														variant="ghost"
														size="sm"
														className="text-lg"
														onClick={() => handleReaction(emoji)}
													>
														{emoji}
													</Button>
												))}
											</div>
										</PopoverContent>
									</Popover>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="sm" onClick={() => setReplyTo(msg)}>
													<Reply className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Reply</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="sm">
													<Flag className="h-4 w-4 text-red-500" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Flag message</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							)}
						</div>
					))}
					{showScrollToBottom && chat.length > 10 && (
						<div className="sticky bottom-0 z-10 flex justify-center py-2 bg-gradient-to-t from-background to-transparent">
							<Button
								variant="secondary"
								size="sm"
								className="rounded-full shadow-md"
								onClick={() => scrollToBottom("down")}
							>
								<ArrowDown className="h-4 w-4 mr-2" />
								View recent messages
							</Button>
						</div>
					)}
				</div>

				<footer className="p-2 border-t border-border">
					{replyTo && (
						<div className="flex items-center justify-between bg-muted p-2 rounded mb-2">
							<div className="flex items-center space-x-2">
								<Reply className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm text-muted-foreground">Replying to {replyTo.from.Username}</span>
							</div>
							<Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
								<X className="h-4 w-4" />
							</Button>
						</div>
					)}

					{alert && alert.flag && (
						<Alert variant={alert.type === "error" ? "destructive" : "default"} className="mb-2">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>{alert.type === "error" ? "Error" : "Success"}</AlertTitle>
							<AlertDescription>{alert.message}</AlertDescription>
							<Button
								variant="ghost"
								size="sm"
								className="absolute top-2 right-2"
								onClick={() => setAlert({ flag: false, message: "", type: "success" })}
							>
								<X className="h-4 w-4" />
							</Button>
						</Alert>
					)}

					<div className="flex items-end space-x-2">
						<Textarea
							ref={textareaRef}
							placeholder="Type a message..."
							className="flex-1 min-h-[40px] max-h-[120px] resize-none"
							value={message}
							onChange={handleMessageChange}
							onKeyDown={(evt) => {
								if (evt.key === "Enter") {
									evt.preventDefault();
									sendMessage();
								}
							}}
						/>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="ghost" size="icon">
									<SmilePlus className="h-4 w-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-64 p-0">
								<Tabs defaultValue="emoji" className="w-full">
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="emoji">Emoji</TabsTrigger>
										<TabsTrigger value="stickers">Stickers</TabsTrigger>
									</TabsList>
									<TabsContent value="emoji">
										<ScrollArea className="h-[200px] w-full rounded-md border p-4">
											<div className="grid grid-cols-8 gap-2">
												{emojis.map((emoji) => (
													<Button
														key={emoji}
														variant="ghost"
														size="sm"
														className="text-lg"
														onClick={() => insertEmoji(emoji)}
													>
														{emoji}
													</Button>
												))}
											</div>
										</ScrollArea>
									</TabsContent>
									<TabsContent value="stickers">
										<ScrollArea className="h-[200px] w-full rounded-md border p-4">
											<div className="grid grid-cols-2 gap-2">
												{giphyStickers.map((sticker, index) => (
													<Button
														key={index}
														variant="ghost"
														size="sm"
														className="p-0"
														onClick={() => setMessage(message + ` [sticker:${index}]`)}
													>
														<img src={sticker} alt={`Sticker ${index + 1}`} className="w-full h-auto" />
													</Button>
												))}
											</div>
										</ScrollArea>
									</TabsContent>
								</Tabs>
							</PopoverContent>
						</Popover>
						<Button variant="default" onClick={sendMessage}>
							<Send className="h-4 w-4 mr-2" />
							Send
						</Button>
					</div>
					{showEmojiSuggestions && (
						<div className="absolute bottom-16 left-2 right-2 mt-2 p-2 bg-popover rounded shadow-md">
							<ScrollArea className="h-32">
								<div className="grid grid-cols-2 gap-2">
									{emojiNames.map((name, index) => (
										<Button key={name} variant="ghost" size="sm" onClick={() => insertEmoji(emojis[index])}>
											{emojis[index]} :{name}:
										</Button>
									))}
								</div>
							</ScrollArea>
						</div>
					)}
				</footer>
			</div>
		</div>
	);
}
