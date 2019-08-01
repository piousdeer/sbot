import * as c from "./commands"
import {client, BOT_ID} from "./bot"

import got from 'got'

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
export function getGuild(guildName) {
	if (!guildName) {
		return null
	}
	if (guildName.match(/^\d+$/g)) {
		if (client.guilds.get(guildName)) {
			return guildName
		}
	}
	let guildId
	let guildIdFull
	client.guilds.forEach(key => {
		if (guildName == getSimpleString(key.name)) {
			guildIdFull = key.id
		} else if (getSimpleString(key.name).match(new RegExp("^(" + escapeRegExp(guildName) + ")"))) {
			guildId = key.id
		}
	})
	if (!(guildId || guildIdFull)) {
		return
	}
	return (guildIdFull) ? guildIdFull : guildId
}
export function getStorage(emojiName, guildName, channel) {
	if (guildName) {
		if (guildName.match(/^\d+$/g)) {
			if (client.guilds.get(guildName)) {
				return client.guilds.get(guildName)
			}
		}
		let guildId
		let guildIdFull
		client.guilds.forEach(key => {
			if (guildName == getSimpleString(key.name)) {
				guildIdFull = key.id
			} else if (getSimpleString(key.name).match(new RegExp("^(" + escapeRegExp(guildName) + ")"))) {
				let currentGuildId = key.id
				client.guilds.get(key.id).emojis.forEach(key => {
					if (key.name.toLowerCase().match(new RegExp("^(" + escapeRegExp(emojiName) + ")"))) {
						guildId = currentGuildId
					}
				})
			}
		})
		if (!(guildId || guildIdFull)) {
			return client
		}
		return (guildIdFull) ? client.guilds.get(guildIdFull) : client.guilds.get(guildId)
	} else {
		return client
	}
}
export function findEmoji(emojiName, guildName, channel) {
	let emoji
	let emojiFull

	if (emojiName.match(/^\d+$/g)) {
		if (client.emojis.get(emojiName)) {
			emoji = client.emojis.get(emojiName)
			return emoji
		}
	}

	let storage = getStorage(emojiName, guildName, channel)

	if (!storage) {
		return
	}

	storage.emojis.forEach(key => {
		if (emojiName == key.name.toLowerCase()) {
			emojiFull = key
		} else if (key.name.toLowerCase().match(new RegExp("^(" + escapeRegExp(emojiName) + ")"))) {
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
export function findUserToGetAvatar(username) {
	// проверка на айди
	if (username.match(/^\d+$/g)) {
		if (client.users.get(username)) {
			return client.users.get(username)
		}
	}

	// проверка на призывалку
	let usernameId = username.match(/<@\!?(\d+)>/)
	if (usernameId) {
		if (client.users.get(usernameId[1])) {
			return client.users.get(usernameId[1])
		}
	}

	let guildsCounter = 0
	let isDisplayNameSuitable = false
	let isDisplayNameCanBeSuitable = false
	let result

	if (username.split("#")[1]) {
		client.users.forEach(u => {
			if (username == u.tag.toLowerCase()) {
				result = u
			}
		})
	}

	client.guilds.forEach(guild => {
		let usersCounter = 0
		guild.members.forEach(member => {
			if (member.user.avatar) {
				if (username == getSimpleString(member.displayName)) {
					result = member.user
					isDisplayNameSuitable = true
				} else if (getSimpleString(member.displayName).match(new RegExp("^(" + escapeRegExp(username) + ")"))) {
					if (!isDisplayNameSuitable) {
						result = member.user
						isDisplayNameCanBeSuitable = true
					}
				} else if (member.nickname) {
					if (username == getSimpleString(member.user.username)) {
						if (!isDisplayNameSuitable && !isDisplayNameCanBeSuitable) {
							result = member.user
						}
					} else if (getSimpleString(member.user.username).match(new RegExp("^(" + escapeRegExp(username) + ")"))) {
						if (!result && !isDisplayNameSuitable && !isDisplayNameCanBeSuitable) {
							result = member.user
						}
					}
				}
			}
		})
	})
	return result
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

	if (!findEmoji(emojiName, guildName, msg.channel)) {
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
export function sendEmojiLinkEmbed(msg, emoji) {
	if (emoji.animated) {
		msg.channel.send({embed: {title: "Emoji", description: ("<a:" + emoji.name + ":" + emoji.id + "> – " + emoji.name), image: {url: ("https://cdn.discordapp.com/emojis/" + emoji.id + ".gif")}}})
	} else {
		msg.channel.send({embed: {title: "Emoji", description: ("<:" + emoji.name + ":" + emoji.id + "> – " + emoji.name), image: {url: ("https://cdn.discordapp.com/emojis/" + emoji.id + ".png")}}})
	}
}
let botsChannels = [
	{
		g: "110107304413638656",
		c: "334369998866874369"
	},
	{
		g: "540145900526501899",
		c: "600294780144189481"
	}
]
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
export function checkHomestuckReaction(messageReaction, user) {
	let msg = messageReaction.message
	let msgReaction = messageReaction.emoji.name

	if (["⬅", "➡"].includes(msgReaction) && msg.author.id == BOT_ID && user.id != BOT_ID) {
		let msg = messageReaction.message
		let cMatch, eMatch, page_number
		if (cMatch = msg.content.match(/hs#(\d+)/)) {
			page_number = Number(cMatch[1])
		} else if (msg.embeds[0] && (eMatch = msg.embeds[0].author.name.match(/hs#(\d+)/))) {
			page_number = Number(eMatch[1])
		}

		if (page_number) {
			if (msgReaction == "➡") {
				c.Homestuck(msg, [page_number + 1], null, true)
			} else if (msgReaction == "⬅") {
				c.Homestuck(msg, [page_number - 1], null, true)
			}
		}

	}
}
export function setCinemaRole(user, doesUserNeedRole, emojiCode) {
	let roleID
	if (emojiCode == "📽") roleID = "565291444705689612"
	if (emojiCode == "⛩") roleID = "577130367304204288"
	if (emojiCode == "🎮") roleID = "577143343281340427"
	

	client.guilds.get("540145900526501899").fetchMember(user.id)
		.then((member) => {
			if (doesUserNeedRole) {
				console.log(member.user.tag + " asked to add them " + emojiCode + " role.")
				member.addRole(roleID)
					.then(() => {})
					.catch(error => console.log(error))
			} else {
				console.log(member.user.tag + " asked to remove them " + emojiCode + " role.")
				member.removeRole(roleID)
					.then(() => {})
					.catch(error => console.log(error))
			}
		})
		.catch(error => console.log(error))
}
export function sfTime(s) {
    return new Date(1420070400000 + s / 4194304)
}
export function dateStr(d) {
    if (!d.toJSON) {
        d = new Date(d)
    }
    d.setHours(d.getHours() + 3)
    return d.toJSON().split(".")[0].replace(/T/, ' ') + ' МСК'
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
export function checkEmojiListReaction(msgReaction, user, msg, visibleServers) {
	if (msg.author.id == BOT_ID && user.id != BOT_ID) {
		let turn = ""
		if (msgReaction == "⬅") {
			turn = "-"
		} else if (msgReaction == "➡") {
			turn = "+"
		}
		c.EmojiList(msg, [turn], false, true, visibleServers)
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