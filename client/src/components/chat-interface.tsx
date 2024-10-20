"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Send,
	SmilePlus,
	Flag,
	Reply,
	X,
	ArrowUp,
	ArrowDown,
	AlertCircle,
	SettingsIcon,
	FileTextIcon,
	EyeOff,
	Eye
} from "lucide-react";
import axios from "axios";
import { ChatMessage, getItemFromChromeStorage } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import RepliedMessage from "./RepliedMessage";

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
	updateType,
	isChatLoading,
	handleNewTab
}: {
	currentURL: string | null;
	chat: ChatMessage[];
	setChat: Function;
	hasMoreMessages: boolean;
	handleLoadMessages: Function;
	updateType: string;
	isChatLoading: boolean;
	handleNewTab: Function;
}) {
	const [darkMode, setDarkMode] = useState(true);
	const [showFlaggedContent, setShowFlaggedContent] = useState<{
		[key: string]: any; // Allows any string key
	}>({});
	const [tab, setTab] = useState<Number>(1);
	const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
	const [usersCount, setUsersCount] = useState(0);
	const [message, setMessage] = useState("");
	const [showEmojiSuggestions, setShowEmojiSuggestions] = useState(false);
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
		const handleScroll = () => {
			if (chatRef.current) {
				const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
				setShowScrollToBottom(scrollTop < scrollHeight - clientHeight - 100);
			}
		};

		chatRef.current?.addEventListener("scroll", handleScroll);
		return () => chatRef.current?.removeEventListener("scroll", handleScroll);
	}, []);

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
	}, [updateType]);

	useEffect(() => {
		let interval = setInterval(() => {
			axios.get(`${import.meta.env.VITE_BASE_URL}/metadata?SiteId=${currentURL}`).then((resp: any) => {
				setUsersCount(resp.data.live);
			});
		}, 5000);

		return () => clearInterval(interval);
	}, [currentURL]);

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
			setMessage("");
			const headers: { [key: string]: string } = {};
			if (userId && message.length > 0) {
				// @ts-ignore
				headers["X-Id"] = userId;
				let messageObj = {
					Timestamp: new Date().toISOString(),
					// @ts-ignore
					From: { Id: String(userId), Username: myProfile["Username"] },
					To: (replyTo && replyTo._id) || "",
					Reactions: {},
					Flagged: {},
					Message: message,
					ChannelId: currentURL
				};
				let response = await axios.post(
					`${import.meta.env.VITE_BASE_URL}/send?SiteId=${currentURL}`,
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
				setReplyTo(null);
				scrollToBottom("bottom");
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
				await axios.post(`${import.meta.env.VITE_BASE_URL}/react/${hoveredMessage}`, { emoji }, { headers });
			}
		} catch (error) {}
	};

	const handleChangeTab = (tabIndex: Number) => {
		setTab(tabIndex);
	};

	const handleReportMessage = async () => {
		let userId = await getItemFromChromeStorage("user_id");
		try {
			setHoveredMessage(null);
			const headers: { [key: string]: string } = {};
			if (userId && hoveredMessage) {
				// @ts-ignore
				headers["X-Id"] = userId;
				await axios.post(`${import.meta.env.VITE_BASE_URL}/report/${hoveredMessage}`, {}, { headers });
			}
		} catch (error) {}
	};

	const convertLinksToTags = (text: string) => {
		const urlRegex = /https?:\/\/[^\s]+/g;

		const parts = text.split(urlRegex);
		const matches = text.match(urlRegex); // Store matches here

		return parts.reduce<React.ReactNode[]>((acc, part, i) => {
			if (i === 0) return [part]; // If it's the first part, just return it

			const match = matches ? matches[i - 1] : ""; // Check if matches is not null

			return [
				...acc,
				<a
					onClick={() => handleNewTab(match)}
					href={match}
					key={i}
					className="underline text-grey-600 hover:text-grey-800"
					target="_blank"
					rel="noopener noreferrer"
				>
					{match}
				</a>,
				part
			];
		}, []);
	};

	const toggleFlaggedContent = (messageId: string) => {
		setShowFlaggedContent((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
	};

	return (
		<div className={`flex flex-col h-screen w-full ${darkMode ? "dark" : ""}`}>
			<div className="flex flex-col h-full bg-background text-foreground border border-border rounded-lg overflow-hidden">
				<header className="flex flex-col border-b border-border">
					<div className="flex items-center justify-between p-2 space-y-2">
						<span className="text-sm font-medium truncate">{currentURL}</span>
					</div>
					<Tabs defaultValue="chat" className="w-full">
						<TabsList defaultValue="chat" className="flex w-full items-center">
							<TabsTrigger value="chat" onClick={() => handleChangeTab(1)} className="flex-grow justify-start">
								<div className="flex items-center">
									<span className="relative flex h-2 w-2 mr-2">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
										<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
									</span>
									<span className="text-sm font-medium whitespace-nowrap">
										Live chat <span className="font-thin">({usersCount} users)</span>
									</span>
								</div>
							</TabsTrigger>
							<TabsTrigger value="settings" onClick={() => handleChangeTab(2)} className="w-10 flex justify-center">
								<SettingsIcon className="h-4 w-4" />
							</TabsTrigger>
							<TabsTrigger value="about" onClick={() => handleChangeTab(3)} className="w-10 flex justify-center">
								<FileTextIcon className="h-4 w-4" />
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</header>

				{tab === 1 && (
					<>
						<div className="text-sm text-muted-foreground p-2">
							Are you liking the plugin? Provide feedback -
							<a className="text-blue-500 underline" onClick={() => handleNewTab("https://tally.so/r/wb8DL1")} href="">
								Feedback form
							</a>
						</div>
						<Separator className="mt-1" />
						<div className="flex-1 overflow-y-auto space-y-4 px-4 my-2 scroll-smooth" ref={chatRef}>
							{hasMoreMessages && (
								<div className="flex justify-center py-2 bg-gradient-to-b from-background to-transparent">
									<Button variant="secondary" size="sm" className="rounded-full shadow-md" onClick={loadMoreMessages}>
										<ArrowUp className="h-4 w-4 mr-2" />
										Load more messages
									</Button>
								</div>
							)}

							{isChatLoading &&
								new Array(10).fill(10).map(() => (
									<div className="flex items-center space-x-4">
										<Skeleton className="h-12 w-12 rounded-full" />
										<div className="space-y-2">
											<Skeleton className="h-4 w-[150px]" />
											<Skeleton className="h-4 w-[90px]" />
										</div>
									</div>
								))}

							{!isChatLoading && chat.length === 0 && (
								<div className="flex-1 justify-center">
									No messages to show, you would be the first one to put a message here
								</div>
							)}
							{!isChatLoading &&
								chat.map((msg: any) => (
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
														{new Date(msg.updated_at).toLocaleString("en-US", {
															weekday: "short", // Mon
															year: "numeric", // 2024
															month: "short", // Oct
															day: "numeric", // 24
															hour: "numeric", // 4 PM
															minute: "numeric", // Optional if you don't want minutes
															hour12: true // 12-hour format with AM/PM
														})}
													</span>
												</div>
												{msg.to && msg.to !== "" && <RepliedMessage _id={msg.to} channel={currentURL || ""} />}
												<p
													className={`mt-1 text-sm break-all ${
														msg.flagged && msg.flagged["FLAG_CODE_1"] && !showFlaggedContent[msg._id] ? "blur-sm" : ""
													}`}
												>
													{convertLinksToTags(msg.message)}
												</p>
												{msg.flagged && msg.flagged["FLAG_CODE_1"] && (
													<div className="flex items-center mt-2 mb-1">
														<Flag strokeWidth={1} className="h-4 w-4 text-red-500 mr-1" />
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="link"
																		className="p-0 h-auto font-normal text-left text-red-600 dark:text-red-400 text-xs font-thin"
																	>
																		{msg.flagged["FLAG_CODE_1"].length} user(s) flagged this message
																	</Button>
																</TooltipTrigger>
																<TooltipContent side="bottom" align="start" className="max-w-xs">
																	Users find this message inappropriate
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												)}
												{msg.sticker && <img src={msg.sticker} alt="Sticker" className="mt-2 max-w-[200px] rounded" />}
											</div>
											<div className="flex items-center flex-wrap">
												{msg.flagged && msg.flagged["FLAG_CODE_1"] && (
													<Button
														variant="secondary"
														size="sm"
														className="text-xs mr-1 mt-1 w-[80px]"
														onClick={() => toggleFlaggedContent(msg._id)}
													>
														{showFlaggedContent[msg._id] ? (
															<>
																<EyeOff className="h-4 w-4 mr-1" />
																Hide
															</>
														) : (
															<>
																<Eye className="h-4 w-4 mr-1" />
																Show
															</>
														)}
													</Button>
												)}

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
											<div className="absolute right-0 top-4 flex items-center space-x-1 bg-background/80 backdrop-blur-sm rounded p-1">
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
															<Button onClick={handleReportMessage} variant="ghost" size="sm">
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
									maxLength={255}
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
					</>
				)}

				{tab === 2 && (
					<div className="flex items-center space-x-2 p-2">
						<Switch id="mode" onClick={toggleDarkMode} />
						<Label htmlFor="mode">{darkMode ? "Dark" : "Light"} mode</Label>
					</div>
				)}

				{tab === 3 && (
					<div className="flex h-screen overflow-y-auto items-center space-x-2 p-2">
						<div className="p-4 text-sm overflow-y-auto h-full max-h-full">
							<h2 className="font-semibold mb-2">Guidelines for Usage</h2>
							<p className="italic text-gray-500 mb-4">(Scroll till end)</p>

							<p className="text-gray-700 mb-4">Last updated: Oct 11, 2024</p>

							<h3 className="font-semibold mb-2">Creator's Note</h3>
							<p className="text-gray-700 mb-4">
								This plugin is purely created as an individual side project, so please do not expect any guarantees or
								warranties of this software. All messages are deleted by default after 7 days.
							</p>

							<h3 className="font-semibold mb-2">Freedom of Speech</h3>
							<p className="text-gray-700 mb-4">
								I/We, as the creator of this plugin, believe in democracy and freedom of speech. You, as the user of
								this plugin, are allowed to practice your freedom of speech. However, we request you to abide by the
								laws of your country. The following activities are banned on this platform:
							</p>
							<ul className="list-disc list-inside mb-4 text-gray-700">
								<li>Hate speech</li>
								<li>Any kind of terrorist activities</li>
								<li>Selling of illegal physical or digital goods</li>
								<li>Child and adult pornography</li>
								<li>Sexual harassment</li>
								<li>Sexual media</li>
							</ul>

							<h3 className="font-semibold mb-2">Direction of Use</h3>
							<p className="text-gray-700 mb-4">
								We hope you like our plugin and appreciate the effort we've put into it. We would love if you use this
								app to meet new people, share ideas and experiences, make new friends, and feel good without judging
								each other.
							</p>

							<p className="text-gray-700 mt-4">
								Write us:{" "}
								<a
									onClick={() => handleNewTab("mailto:manage.blablah@gmail.com")}
									href=""
									className="text-blue-500 underline"
								>
									manage.blablah@gmail.com
								</a>
							</p>
							<p className="text-gray-700">
								Created by:{" "}
								<a
									onClick={() => handleNewTab("https://x.com/ajagundeomkar")}
									href=""
									className="text-blue-500 underline"
								>
									@ajagundeomkar
								</a>
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
