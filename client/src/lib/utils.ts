import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeSiteUrl(url: string) {
    const site = new URL(url)
    if (url.includes("youtube")) { }
    if (url.includes("amazon")) { }
    return `${site.protocol}//${site.host}${site.pathname}`   
}

 // Set item in Chrome storage
export const setItemInChromeStorage = (key: string, value: any) => {
    // @ts-ignore
    chrome.storage.local.set({ [key]: value }, () => {
      console.log(`${key} is set to ${value}`);
    });
};

  // Get item from Chrome storage
export const getItemFromChromeStorage = (key: string) => {
    return new Promise((resolve, _) => {
        // @ts-ignore
        chrome.storage.local.get([key], (result: any) => {
            resolve(result[key])
        });
    })
};


export interface ChatMessage {
    MsgId: string,
    Values: {
        Timestamp: string;
        From: {
            Id: string;
            Avatar: string;
            Username: string;
        };
        To: string;
        Reactions:
            | {
                    [key: string]: number;
            }
            | {};
        Flagged: string[];
        Message: string;
    }
}