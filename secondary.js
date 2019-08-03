import {client} from "./bot"
import {botsChannels} from "./config"

import got from "got"

let timeoutForAutoReact
let whoNeedsToReactToSomething = {}
let whichGuildThisUserMeans = {}

export function sentLog(msg, text, options) {
	console.log(`${(new Date).toLocaleString("ru", options)} <${msg.author.tag}> ${text}`)
}
export function escapeRegExp(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
export function getRandomElem(arr) {
	return arr[Math.floor(arr.length*Math.random())]
}
export function getSimpleString(str) {
	return str.replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е")
}
export function pluralize(n, arr) {
	// by PLAYER_CHAR
	let k = n % 10
	return arr[(n - k) / 10 % 10 != 1 ? (k != 1 ? ([2, 3, 4].includes(k) ? 1 : 2) : 0) : 2]
}
export function envelope(msg) {
	// функция для реакции конвертом
	if (msg.channel.type == "text") {
		msg.react("✉")
	}
}
export function getGuild(guildName, emojiName) {
	if (!guildName) {
		return null
	} else if (guildName.match(/^\d+$/g) && client.guilds.get(guildName)) {
		return guildName
	} else {
		let guildId
		let guildIdFound = false
		client.guilds.forEach(key => {
			if (guildName == getSimpleString(key.name)) {
				guildId = key.id
				guildIdFound = true
			} else if (!guildIdFound && getSimpleString(key.name).startsWith(guildName)) {
				if (emojiName) {
					let currentGuildId = key.id
					client.guilds.get(key.id).emojis.forEach(key => {
						if (key.name.toLowerCase().startsWith(emojiName)) {
							guildId = currentGuildId
						}
					})
				} else {
					guildId = key.id
				}
			}
		})
		return guildId
	}
}
export function findEmoji(emojiName, guildName) {
	let emoji
	let emojiFull

	if (emojiName.match(/^\d+$/g)) {
		let emojiGotById = client.emojis.get(emojiName)
		if (emojiGotById) {
			return emojiGotById
		}
	}

	let storage = client.guilds.get(getGuild(guildName, emojiName))

	if (!storage) {
		storage = client
	}

	storage.emojis.forEach(key => {
		if (emojiName == key.name.toLowerCase()) {
			emojiFull = key
		} else if (key.name.toLowerCase().startsWith(emojiName)) {
			emoji = key
		}
	})

	return (emojiFull) ? emojiFull : emoji
}
export function getEmojiName(emojiText) {
	let emojiRaw
	if (emojiRaw = emojiText.match(/(?:<:[^:]+:(\d+)>)/)) {
		return emojiRaw[1]
	} else {
		return emojiText
	}
}
export function autoreact(msg, args, isCommandCanBeAnEmoji) {
	if (!args[0]) {
		msg.react("📜")
		return
	}

	let emojiName
	let guildName

	let guildCheck

	emojiName = getEmojiName(args.join(" "))

	let emojiError = ["👋", "😶", "🤔", "351002389991653378", "358952906248028160", "357960229259837440", "520641845634531328"]

	if (guildCheck = emojiName.match(/^([^:]+)(?::([\S\s]+))$/)) {
		emojiName = guildCheck[1]
		guildName = guildCheck[2]
	}

	if (!findEmoji(emojiName, guildName)) {
		if (isCommandCanBeAnEmoji) {
			msg.react(getRandomElem(emojiError))
		} else {
			msg.react("604015450304806952")
		}
		return
	}

	msg.react("👌")

	whoNeedsToReactToSomething[msg.author.id] = emojiName
	whichGuildThisUserMeans[msg.author.id] = guildName
	
	deleteUserMessage(msg)
}
export function deleteUserMessage(msg) {
	if (msg.channel.type == "text") { // если бот не начал "беседовать" с юзером
		let bot_permissions = msg.channel.permissionsFor(client.user)
		if (bot_permissions.has("MANAGE_MESSAGES")) {
			msg.delete(10000)
				.then(() => {})
				.catch(error => console.log(error))
		}
	}
}
export function isThisBotsChannel(msg) {
	let ch = msg.channel
	if (ch.type == "text") {
		for (let i = 0; i < botsChannels.length; i++) {
			if (ch.guild.id == botsChannels[i].g && ch.id != botsChannels[i].c) {
				return false
			}
		}
	}
	return true
}
export function showHomestuckPage(msg, comic_embed, usedArrowButton, contentText) {
	let embed = {embed: comic_embed}
	if (usedArrowButton) {
		if (contentText) {
			msg.edit(contentText, embed)
		} else {
			msg.edit(embed)
		}
	} else {
		let contentToSend = (contentText) ? contentText : embed
		msg.channel.send(contentToSend)
			.then((msg) => {
				msg.react("⬅")
					.then(() => {
						msg.react("➡")
					})
					.catch(error => console.log(error))
			})
			.catch(error => console.log(error))
	}
}
export function checkReactionForAutoreact(messageReaction, user) {
	if (whoNeedsToReactToSomething[user.id]) {
		let currentUser = client.users.get(user.id)
		let currentEmoji = findEmoji(whoNeedsToReactToSomething[user.id], whichGuildThisUserMeans[user.id])

		messageReaction.message.react(currentEmoji)
		clearTimeout(timeoutForAutoReact)

		delete whoNeedsToReactToSomething[user.id]
		delete whichGuildThisUserMeans[user.id]

		let timerForDeletingAutoReaction = setTimeout(() => {
			messageReaction.message.reactions.get(currentEmoji.name + ":" + currentEmoji.id).remove(client.user)
		}, 25000)

		messageReaction.message.awaitReactions((messageReactionAwaited, user) => {
			if (user.id == currentUser.id && messageReactionAwaited.emoji.id == currentEmoji.id) {
				messageReactionAwaited.message.reactions.get(messageReactionAwaited.emoji.name + ":" + messageReactionAwaited.emoji.id).remove(client.user)
				clearTimeout(timerForDeletingAutoReaction)
			}
		}, { time: 25000 })

		return true
	} else {
		return false
	}
}
export async function sendAttachmentToImgur(attURL) {
	const IMGUR_ID = process.env.IMGUR_ID

	if (!IMGUR_ID) {
		console.log("Error! No IMGUR_ID here!")
	}

	let response = await got.post("https://api.imgur.com/3/image", {
		headers: {
			"authorization": `Client-ID ${IMGUR_ID}`
		},
		body: {type: "URL", image: attURL},
		json: true
	})

	let imgurData
	if (response) {
		imgurData = response.body.data
	}

	if (imgurData && !imgurData.error) {
		return [imgurData.link, imgurData.id]
	} else {
		return false
	}
}
export function hashCode(str) {
    let hash = 0;
    if (str.length == 0) {
        return hash;
    }
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}
export function rgb2hsv([r,g,b]) {
	var computedH = 0;
	var computedS = 0;
	var computedV = 0;

	r=r/255; g=g/255; b=b/255;
	var minRGB = Math.min(r,Math.min(g,b));
	var maxRGB = Math.max(r,Math.max(g,b));
   
	// Black-gray-white
	if (minRGB==maxRGB) {
	 computedV = minRGB;
	 return [0,0,computedV];
	}
   
	// Colors other than black-gray-white:
	var d = (r==minRGB) ? g-b : ((b==minRGB) ? r-g : b-r);
	var h = (r==minRGB) ? 3 : ((b==minRGB) ? 1 : 5);
	computedH = 60*(h - d/(maxRGB - minRGB));
	computedS = (maxRGB - minRGB)/maxRGB;
	computedV = maxRGB;
	return [computedH,computedS,computedV];
}
export function hsv2rgb([h, s, v]) {
    h = h / 360
    var r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}