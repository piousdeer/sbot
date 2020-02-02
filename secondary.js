import {client} from "./bot"
import {botsChannels} from "./config"

import got from "got"
import jimp from "jimp"
import skmeans from "skmeans"

let timeoutForAutoReact
let whoNeedsToReactToSomething = {}
let whichGuildThisUserMeans = {}

// general methods

export function sentLog(msg, text, options) {
	console.log(`${(msg.channel.type == "text") ? msg.channel.id : "by direct messages"} | ${(new Date).toLocaleString("en-US", options)} <${msg.author.tag}> ${text}`)
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
export function deleteUserMessage(msg, time) {
	if (time === undefined) {
		time = 10000
	}
	if (msg.channel.type == "text" && msg.guild.member(client.user.id).hasPermission('MANAGE_MESSAGES')) {
		msg.delete(time)
		.then(() => {})
		.catch(error => console.log(error))
		return true
	} else {
		return false
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
export function removeElementsByValue(arr) {
    let what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax= arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}
export function indexOfClosestValueInArray(num, arr) {
	let curr = 0
	for (let i = 0; i < arr.length; i++) {
		if (Math.abs(num - arr[i]) < Math.abs(num - arr[curr])) {
			curr = i
		}
	}
	return curr
}
export function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// emoji methods

export function getGuild(guildName, emojiName) {
	let guildId
	if (!guildName) {
		guildId = null
	} else if (guildName.match(/^\d+$/g) && client.guilds.get(guildName)) {
		guildId = guildName
	} else {
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
	}
	return client.guilds.get(guildId)
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

	let storage = getGuild(guildName, emojiName)

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

// reaction methods

export function autoreact(msg, args, isCommandCanBeAnEmoji) {
	if (!args[0]) {
		msg.react("📜")
		return false
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
		return false
	}

	msg.react("👌")

	whoNeedsToReactToSomething[msg.author.id] = emojiName
	whichGuildThisUserMeans[msg.author.id] = guildName
	
	deleteUserMessage(msg)
	return true
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

// special methods

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
export function trimPunc(str) {
	return str.match(/^[\s'`"]*([^]+?)[\s'`",.(\)]*$/)[1]
}
export function getRGBFromHex(hex) {
	let Red = Math.floor(hex / 256 / 256) % 256
	let Green = Math.floor(hex / 256) % 256
	let Blue = hex % 256
	return [Red, Green, Blue]
}
export function grayFromRGBAHex(hex) {
	let colors = getRGBFromHex(hex)
	let GrayHue = Math.round(colors[0] * 0.2126 + colors[1] * 0.7152 + colors[2] * 0.0722)
	let GrayHex = GrayHue*256*256*256 + GrayHue*256*256 + GrayHue*256 + 255
	return GrayHex
}
export async function getMainColorFromImage(link, callback, cnum) {
	let dataset = []
	try {
		jimp.read(link)
			.then(image => {
				if (image.bitmap.width > 160) {
					image.resize(160,jimp.AUTO)
				}

				if (!cnum) {
					cnum = 10
				}

				image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
					if (this.bitmap.data[idx + 3] > 64) {
						dataset.push([this.bitmap.data[idx + 0], this.bitmap.data[idx + 1], this.bitmap.data[idx + 2]])
					}

					if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1) {
						let color
						let palette = []
						if (dataset.length) {
							let centroids = skmeans(dataset, cnum, "kmpp", 100).centroids
							let hsvColors = []
							for (let i = 0; i < centroids.length; i++) {
								hsvColors.push(rgb2hsv(centroids[i]))
							}
							hsvColors.sort((a, b) => {
								return (b[1]+0.01)*b[2]*b[2] - (a[1]+0.01)*a[2]*a[2]
							})
							for (let i = 0; i < hsvColors.length; i++) {
								let colorRGB = hsv2rgb(hsvColors[i])
								palette.push(colorRGB[0]*256*256 + colorRGB[1]*256 + colorRGB[2])
							}
							color = palette[0]
						} else {
							color = undefined
						}

						if (callback) {
							callback(color, palette)
						}
					}
				})
			})
			.catch(err => {
				console.log(err)
			})
	} catch (err) {
		console.log(err)
	}
}
export async function recolorByPalette(link, pal, callback) {
	let palnum = (pal.length > 20) ? pal.length : 20
	await getMainColorFromImage(link, (color, paletteFromImage) => {
		paletteFromImage.sort((a,b) => grayFromRGBAHex(b) - grayFromRGBAHex(a))
		let paletteFromUser = pal
		let paletteReady = []
		for (let i = 0; i < paletteFromImage.length; i++) {
			let bestSimilarity = Infinity
			let colorHex
			let cI = getRGBFromHex(paletteFromImage[i])
			for (let j = 0; j < paletteFromUser.length; j++) {
				let cU = getRGBFromHex(paletteFromUser[j])
				let similarity = Math.sqrt((cU[0] - cI[0])**2 + (cU[1] - cI[1])**2 + (cU[2] - cI[2])**2)
				if (similarity < bestSimilarity) {
					bestSimilarity = similarity
					colorHex = paletteFromUser[j]
				}
			}
			paletteReady.push(colorHex)
		}
		try {
			jimp.read(link)
				.then(image => {
					image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
						if (this.bitmap.data[idx + 3] > 64) {
							let bestSimilarity = Infinity
							let colorHex
							let cI = getRGBFromHex(image.getPixelColor(x, y))
							for (let j = 0; j < paletteReady.length; j++) {
								let cU = getRGBFromHex(paletteReady[j])
								let similarity = Math.sqrt((cU[0] - cI[0])**2 + (cU[1] - cI[1])**2 + (cU[2] - cI[2])**2)
								if (similarity < bestSimilarity) {
									bestSimilarity = similarity
									colorHex = paletteReady[j]
								}
							}
							image.setPixelColor(colorHex, x, y)
						}
						
						if (x == image.bitmap.width - 1 && y == image.bitmap.height - 1 && callback) {
							image.getBuffer("image/png", (err, buf) => {
								callback(buf)
							})
						}
						
					})
				})
				.catch(err => {
					console.log(err)
				})
		} catch (err) {
			console.log(err)
		}
	}, palnum)
}
export function sftime(arg) {
	let d = new Date(1420070400000 + Number(arg) / 4194304)
	if (!d.toJSON) {
		d = new Date(d)
	}
	d.setHours(d.getHours() + 3)
	let res = {
		timestamp: d,
		string: `\`${d.toJSON().replace(/T/, ' ').replace(/Z/, '')} МСК\``
	}
	return res
}