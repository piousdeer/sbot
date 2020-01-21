import * as s from "./secondary"
import {client, OWNER_ID, BOT_ID, userDB, visibleServers} from "./bot"
import {imgDatabaseURL} from "./config"
import {hiragana, katakana, kanalat, kanji} from "./japdata"

import got from "got"
import Cheerio from "cheerio"
import Intl from "intl"
import fs from "fs"
import jimp from "jimp"

const Canvas = require('canvas')
const { Image } = require('canvas')
Canvas.registerFont('fonts/KosugiMaru-Regular.ttf', { family: 'KosugiMaru' })

export const commands = {
	Help: {
		r: /^(х[еэ]лп|помо(щь|ги)|команды|help|comm?ands?)[.!]?$/,
		v: true,
		f (msg) {
			const helpLines = [
				"Чтобы спросить что-либо, обратись ко мне по имени и введи команду.",
				"Например: `сбот имг креатив намия` (в ЛС можно без обращения)",
				`Пустить меня на свой сервер можно по [этой ссылке](https://discordapp.com/api/oauth2/authorize?client_id=${BOT_ID}&scope=bot&permissions=0).`
			]
			const helpEmbed = {
				color: 0x7486C2,
				title: "Привет, меня зовут СтиллБот <:tuturuMetal:601419582837751810>",
				description: helpLines.join("\n"),
				fields: []
			}

			// collect descriptions
			let cmds = Object.keys(commands)
			for (let cmd of cmds) {
				let d = commands[cmd].d
				if (d) {
					helpEmbed.fields.push(d)
				}
			}
		
			msg.channel.send({embed: helpEmbed})
		}
	},
	Ping: {
		r: /^(пинг|ping)[.!]?$/,
		v: true,
		f (msg) {
			let pongText = "🏓 Понг!"
			msg.channel.send(pongText)
				.then((pong) => {
					let userTime = msg.createdTimestamp / 1000
					let botTime = pong.createdTimestamp / 1000
					let pongTime = (botTime - userTime).toFixed(3)
					pong.edit(`${pongText} ${pongTime} сек`)
				})
				.catch(error => console.log(error))
		}
	},
	Destroy: {
		r: /^(дестрой)[.!]?$/,
		v: true,
		f (msg) {
			if (msg.author.id == OWNER_ID) {
				console.log("Destroying client...")
				msg.author.send("🛌 🌌").then(() => {
					client.destroy().then(() => {
						console.log("Exiting process...")
						process.exit()
					})
				})
			}
		}
	},
	Img: {
		r: /^(пикча|имг|картинк?а|изображение|галерея|img|image|pic(ture)?|gallery)[.!,:]?$/,
		v: true,
		d: {
			name: "имг [теги через пробел]",
			value: "Рандомная пикча из [Галереи](https://stilltest.tk/gallery/).",
			inline: true
		},
		async f (msg, args) {
			let argsText = ""
		
			if (args.length > 0) {
				argsText = args.join(",")
				argsText = "?tags=" + encodeURIComponent(argsText)
			}
		
			try {
				let { body: imageInfo } = await got(`${imgDatabaseURL}random/${argsText}`, { json: true })
				if (imageInfo.error) throw Error(imageInfo.error)
			
				let imageExtension = imageInfo.tags.includes("gif") ? "gif" : "png"
				let imagePreview = `https://i.imgur.com/${imageInfo.id}t.jpg`
				await s.getMainColorFromImage(imagePreview, color => {
					msg.channel.send({
						embed: {
							color: color,
							author: {
								name: imageInfo.title,
								icon_url: "https://i.imgur.com/5EOhj0z.png",
								url: `https://stilltest.tk/gallery/#${imageInfo.id}`
							},
							description: `Теги: ${imageInfo.tags.join(", ")}`
								+ (imageInfo.date ? `\nДата: ${imageInfo.date}` : ""),
							image: {
								url: `https://i.imgur.com/${imageInfo.id}.${imageExtension}`
							}
						}
					})
				})
			} catch (err) {
				await msg.react("604015450304806952")
			}
		}
	},
	Send: {
		r: /^(отправ(ит)?ь|предложи(ть)?|пришли|прислать|send)$/,
		d: {
			name: "<описание пикчи> + прикреплённое изображение 📎",
			value: "Предложить свой скриншот в Галерею (только в ЛС, [пример оформления](https://i.imgur.com/kus289H.png)).\nЕсли я поставил в ответ 📮 - отправка работает."
		},
		async f (msg, args, origCaseParams) {
			let imageParamsArray = origCaseParams.args
		
			if (!imageParamsArray[1]) {
				msg.react("📜")
				msg.channel.send("Чтобы отправить картинку, нужно добавить к ней описание, дату и место.")
				return
			}
		
			let startLink = imageParamsArray[0]
		
			let imgurParams
			let discordLink = ""
		
			let imageLink = startLink
			let imageID = ""
		
			if (!imageLink.includes("//i.imgur.com/")) {
				try {
					imgurParams = await s.sendAttachmentToImgur(imageLink)
					if (imgurParams) {
						discordLink = startLink
						imageLink = imgurParams[0]
						imageID = imgurParams[1]
					}
				} catch (err) {
					if (err.statusCode === 400) {
						msg.channel.send("Похоже, что ссылка не понравилась Имгуру.")
						return
					}
				}
			} else {
				try {
					imageID = imageLink.match(/\/\/i\.imgur\.com\/(.+)\./)[1]
				} catch (err) {}
			}
		
			let imageDate = ""
			if (discordLink) {
				let ogURLParts = discordLink.split("/")
				let ogImgName = ogURLParts[ogURLParts.length - 1]
				if (ogImgName.match(/\d{4}-\d{2}-\d{2}/)) {
					imageDate = ogImgName.match(/\d{4}-\d{2}-\d{2}/)[0]
				}
		
				discordLink = `<${discordLink}>\n`
			}
		

			let dateRE = /\d{4}[-_\.\/\\]\d{2}[-_\.\/\\]\d{2}/i
			let takenByRE = /(?:(?:скрин(?:шот)? )?снято?| ?by|takenby|from)\s*:?\s*(\S+)/i
			let tagsRE = /(?:tags|т[еаэ]ги)(?:\s+)?:?/i
			
			imageParamsArray.shift()
			let imageNote = imageParamsArray.join(" ")
			let customDate = ""
			let takenBy, imageTitle, tagsRaw
			
			try {
				let dateMatch = imageNote.match(dateRE)
				imageNote = imageNote.split(dateMatch[0]).join(" ")
				customDate = dateMatch[0].trim().replace(/[_\.\/\\]/g, "-")
			} catch (err) {}

			try {
				let takenByMatch = imageNote.match(takenByRE)
				imageNote = imageNote.split(takenByMatch[0]).join(" ")
				takenBy = s.trimPunc(takenByMatch[1])
			} catch (err) {}

			try {
				tagsRaw = s.trimPunc(imageNote.split(tagsRE)[1])
			} catch (err) {}

			imageTitle = s.trimPunc(imageNote.split(tagsRE)[0])

			let imageTags = []
			if (tagsRaw) {
				imageTags = tagsRaw.toLowerCase().replace(/^\s+/g, "").split(/[,;\s]+/)
			}
			let tagsToClean = []
			for (let i in imageTags) {
				let minusMatch = imageTags[i].match(/^-(.+)/)
				if (minusMatch) {
					tagsToClean.push(minusMatch[1])
				}
			}
			imageTags.unshift("screenshot", "minecraft")
			for (let i in tagsToClean) {
				s.removeElementsByValue(imageTags, tagsToClean[i], `-${tagsToClean[i]}`)
			}
			let imageTagsText = imageTags.map(x=>'"'+x+'"').join(', ')
		
			let imageJSON = `\`\`\`json\n\t"${imageID}": {\n\t\t"title": ${JSON.stringify(imageTitle)},\n\t\t"date": "${(imageDate) ? imageDate : customDate}",\n\t\t"takenBy": "${(takenBy) ? takenBy : msg.author.username}",\n\t\t"big": true,\n\t\t"tags": [${imageTagsText}]\n\t},\n\`\`\``
		
			client.channels.get("526441608250392577").send("От " + msg.author.tag + ":\n" + discordLink + imageLink + "\n" + imageJSON)
				.then(() => {
					msg.react("📮")
				})
				.catch(error => console.log(error))
		}
	},
	React: {
		r: /^([пpрr]|поставь|отреагируй|реакция|react(ion)?)$/,
		f (msg, args) {
			s.autoreact(msg, args, false) // функция вынесена, так как к ней нужен доступ и без команды
		}
	},
	EmojiList: {
		r: /^(э(мо(д[жз]|ж)и)?|смайл(ики|ы)|emoji(s|list)?)[.!]?$/,
		v: true,
		f (msg, args, origCaseParams, usedArrowButton) {
			let defaultGuildId = "540145900526501899"
			let fromWhichServer = client.guilds.get(defaultGuildId)
			let askedServer = s.getGuild(args[0])
			let numberOfCurrentGuild = visibleServers.indexOf(defaultGuildId) + 1
		
			let goRight = false
			let goLeft = false
			if (args[0] == "+") {
				goRight = true
			} else if (args[0] == "-") {
				goLeft = true
			} else if (askedServer) {
				fromWhichServer = askedServer
				numberOfCurrentGuild = visibleServers.indexOf(askedServer.id) + 1
			}

			let possiblePrevId = msg.content.match(/(\d{17,20})\`$/)
		
			if (usedArrowButton && possiblePrevId) {
				let prevServer = possiblePrevId[1]
				let p = visibleServers.indexOf(prevServer)
				if (p > -1) {
					let n
					if (goRight) {
						n = p + 1
					} else if (goLeft) {
						n = p - 1
					}
					if (n < 0) {
						n = visibleServers.length - 1
					} else if (n >= visibleServers.length) {
						n = 0
					}
		
					numberOfCurrentGuild = n + 1
					fromWhichServer = client.guilds.get(visibleServers[n])
				}
			}
		
			let emServ = fromWhichServer
			if (emServ && emServ.emojis.size) {
				let embed = {
					color: 0xD4A940,
					fields: [
						{
							name: "1-1:",
							value: ""
						}
					],
					footer: {
						text: `📖 ${numberOfCurrentGuild}/${visibleServers.length}`
					}
				}
		
				let i = 0
				let f = 0
				let emojiDesc = "Доступные эмоджи:\n" + emServ.name + " `" + emServ.id + "`"
				let emojiList = []
		
				let fieldStart = 1
		
				emServ.emojis.forEach(key => {
					let prefix = "<:"
					let postfix = ">" + " `" + key.name + "`"
					if (key.animated) {
						prefix = "<a:"
					}
					if (++i % 10 == 1) {
						prefix = "\n" + prefix
					}
					let emojiInfo = prefix + key.name + ":" + key.id + postfix
					emojiList.push(emojiInfo)
					let emListText = emojiList.join(" ")
		
					if (f >= 6) {
						return
					} else if (emListText.length < 993) {
						embed.fields[f].name = fieldStart + "-" + i + ":"
						embed.fields[f].value = emListText
					} else {
						emojiList = []
						emojiList.push(emojiInfo)
						if (emojiInfo.length < 993) {
							fieldStart = i
							f++
							embed.fields[f] = {}
							embed.fields[f].name = fieldStart + "-" + i + ":"
							embed.fields[f].value = emojiInfo
						}
					}
				})
		
				if (usedArrowButton) {
					msg.edit(emojiDesc, {embed: embed})
				} else {
					msg.channel.send(emojiDesc, {embed: embed})
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
		
			return
		}
	},
	Sticker: {
		r: /^(с(тикер)?|sticker|э(мо(д[жз]|ж)и)?линк|e(moji)?link)$/,
		v: true,
		async f (msg, args) {
			if (!args[0]) {
				msg.react("📜")
				return
			}
		
			let emoji
		
			if (args[0].match(/^\d+$/g) && client.emojis.get(args[0])) {
				emoji = client.emojis.get(args[0])
			} else {
				let emojiName = s.getEmojiName(args[0])
				let guildName
				let guildCheck
				if (guildCheck = emojiName.match(/^([^:]+)(?::(\S+))$/)) {
					emojiName = guildCheck[1]
					guildName = guildCheck[2]
				}
				emoji = s.findEmoji(emojiName, guildName)
			}
		
			if (!emoji) {
				msg.react("604015450304806952")
				return
			}

			let imageLink = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`

			await s.getMainColorFromImage(imageLink, color => {
				msg.channel.send({
					embed: {
						color: color,
						description: `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}> – ${emoji.name}`, 
						image: {
							url: imageLink
						}
					}
				})
			})
		}
	},
	Servers: {
		r: /^(сервер[аы]|servers)[.!]?$/,
		f (msg, args) {
			let embed = {
				color: 0x888888,
				description: ""
			}
		
			let showAllServers = false
			if (msg.author.id == OWNER_ID && args[0] == "all") {
				showAllServers = true
			}
		
			let serversArray = []
			let counter = 0
			client.guilds.forEach(key => {
				if (showAllServers || key.emojis.size) {
					counter++
					serversArray.push(key.id + " | " + key.name)
				}
			})
			serversArray.sort((a, b) => {
				return Number(a.split(" | ")[0]) - Number(b.split(" | ")[0])
			})
			embed.description += `\`\`\`${serversArray.join("\n")}\`\`\``
			embed.title = counter + " серверов"
		
			if (!showAllServers) {
				embed.title += " с эмоджи"
			}
		
			msg.author.send({embed: embed})
				.then(() => {
					s.envelope(msg)
				})
				.catch(error => console.log(error))
		}
	},
	Avatar: {
		r: /^(ав(атар(ка)?|к?а)|ava(tar)?|pfp)[.!]?$/,
		v: true,
		d: {
			name: "ава [никнейм или айди юзера]",
			value: "Глянуть чью-то авку.",
			inline: true
		},
		async f (msg, args, origCaseParams) {
			let user
			if (args[0] == "random") {
				user = client.users.filter(u => u.avatar).random()
			} else if ( ["sb", "sbot", "сб", "сбот"].includes(args[0]) ) {
				user = client.users.get(BOT_ID)
			} else if (args[0]) {
				let username = s.getSimpleString(origCaseParams.args.join(" "))
				let result
				let usernameId
				// проверка на айди
				if (usernameId = username.match(/(?:<@\!?)?(\d+)>?/)) {
					await client.fetchUser(usernameId[1]).then(user => {
						result = user
					})
				// проверка на тег
				} else if (username.split("#")[1]) {
					client.users.forEach(u => {
						if (username == u.tag.toLowerCase()) {
							result = u
						}
					})
				} else {
					let isDisplayNameSuitable = false
					let isDisplayNameCanBeSuitable = false
			
					client.guilds.forEach(guild => {
						guild.members.forEach(member => {
							if (member.user.avatar) {
								if (username == s.getSimpleString(member.displayName)) {
									result = member.user
									isDisplayNameSuitable = true
								} else if (s.getSimpleString(member.displayName).startsWith(username)) {
									if (!isDisplayNameSuitable) {
										result = member.user
										isDisplayNameCanBeSuitable = true
									}
								} else if (member.nickname) {
									if (username == s.getSimpleString(member.user.username)) {
										if (!isDisplayNameSuitable && !isDisplayNameCanBeSuitable) {
											result = member.user
										}
									} else if (s.getSimpleString(member.user.username).startsWith(username)) {
										if (!result && !isDisplayNameSuitable && !isDisplayNameCanBeSuitable) {
											result = member.user
										}
									}
								}
							}
						})
					})		
				}
			
				user = result
			} else {
				user = msg.author
			}
		
			if (!(user && user.avatar)) {
				msg.react("604015450304806952")
				return
			}
		
			let fullSizeLink = user.avatarURL.split("?size=")[0] + "?size=2048"
		
			let link = user.avatarURL.split("?size=")[0] + "?size=128"

			await s.getMainColorFromImage(link, color => {
				msg.channel.send({embed: {
					color: color, 
					description: user.tag, 
					image: {
						url: fullSizeLink
					}
				}})
			})

		}
	},
	Invite: {
		r: /^(приглашение|инвайт|invite)[.!]?$/,
		f (msg) {
			msg.author.send("Ты можешь пустить меня на свой сервер с помощью этой ссылки: \n<https://discordapp.com/api/oauth2/authorize?client_id=" + BOT_ID + "&scope=bot&permissions=0>")
				.then(() => {
					s.envelope(msg)
				})
				.catch(error => console.log(error))
		}
	},
	Homestuck: {
		r: /^(hs|хс|хоумстак|homestuck)[.!]?$/,
		v: true,
		async f (msg, args, origCaseParams, usedArrowButton) {
			let page_number
			let contentText = ""

			let domain = 'https://www.homestuck.com'
			let hs_part_mark = "hs#"
			let text_location = "p.type-rg"
		
			let num = Number(args[0])

			if (args[0]) {
				if (num >= 1 && num <= 8130) {
					page_number = args[0]
				} else if (num > 8130) {
					page_number = num % 8130
				} else {
					return
				}
			} else {
				page_number = 1
			}

			if (args[1] == "2" || num > 8130) {
				domain = 'https://www.homestuck2.com'
				hs_part_mark = "hs2#"
				text_location = 'div.type-rg'
			}
		
			let page_link = domain + '/story/' + page_number
			let comic_number = hs_part_mark + page_number
			let got_error_already = false
			let embed_color = 0x249E28
		
			let comic_embed = {
				color: embed_color,
				author: {
					url: page_link,
					name: comic_number
				}
			}
		
			try {
				let hs = await got(page_link, {
					headers: {
						"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:62.0) Gecko/20100101 Firefox/62.0"
					}
				})
		
				let $ = Cheerio.load(hs.body)
		
				let content_container = $('div#content_container')
				let flash_div = $('div#o_flash-container')
		
				// detecting video
				let is_there_video = false
				let yt_link = ""
				let yt_link_code
		
				if (flash_div.length) {
					let yt_raw = flash_div.html().match(/\'youtubeid\', \'(.+)\'/)
					if (yt_raw) {
						yt_link_code = yt_raw[1]
					}
				} else {
					let yt_raw = $('iframe.ar-inner').attr('src')
					if (yt_raw) {
						yt_link_code = yt_raw.match(/embed\/(.+)/)[1]
					}
				}
				if (yt_link_code) {
					yt_link = `https://youtu.be/${yt_link_code}`
					is_there_video = true
				}
		
		
				if (is_there_video) {
					// send title, desc and video link
					comic_embed = {}
					contentText = comic_number + "\n" + yt_link
				} else {
					// getting title
					let comic_title = $('h2.type-hs-header').text()
					if (comic_title && !is_there_video) {
						comic_title = `${comic_title} (${comic_number})`
					} else {
						comic_title = comic_number
					}
					comic_embed.author.name = comic_title
		
					// getting description
					let desc = $(text_location).text().replace(/\ +/g, " ").replace(/^\s+/, "").replace(/\s+$/, "")
					let desc_limit = 2047
					if (desc.length > desc_limit) {
						desc = desc.substring(0, desc_limit) + "…"
					} else if (desc.length == 0) {
						desc = ""
					}
					comic_embed.description = desc
		
					// getting images
					let imgs
					let img_link = ""
					let is_img_from_flash = false
					if (content_container.length) {
						imgs = content_container.find('img.mar-x-auto.disp-bl')
						if (!imgs.length) {
							let imgs_raw = $('div.bg-scratch-mid-green.pad-t-lg').find('img')
							if (imgs_raw.length) {
								imgs = imgs_raw.attr('src')
								is_img_from_flash = true
							}
						}
					} else {
						imgs = $('img.mar-x-auto.disp-bl')
					}
					if (flash_div.length && !imgs.length) {
						let imgs_raw = flash_div.html().match(/\'altimgsrc\', \'(.+)\'/)
						if (imgs_raw) {
							imgs = imgs_raw[1]
							is_img_from_flash = true
						}
					}
					if (imgs.length) {
						// send title, image and desc
						if (is_img_from_flash) {
							img_link = `${domain}${imgs}`
						} else if (imgs.attr('src').startsWith("/")) {
							img_link = `${domain}${imgs.attr('src')}`
						} else {
							img_link = imgs.attr('src')
						}
		
						comic_embed.image = {url: img_link}
					} else {
						// send title and footer
						comic_embed.footer = {text: "It's probably interactive."}
					}
				}
			} catch (err) {
				if (err.statusCode === 404) {
					comic_embed.footer = {text: "It's probably missing page."}
				}
			}
			
			let embed = {embed: comic_embed}
			if (usedArrowButton) {
				if (contentText) {
					msg.edit(contentText, embed)
				} else {
					msg.edit(embed)
				}
			} else {
				let contentToSend = (contentText) ? contentText : embed
				msg.channel.send(contentToSend).then((msg) => {
					msg.react("⬅").then(() => {
						msg.react("➡").then(() => {
							msg.react("🔃")
						})
						.catch(error => console.log(error))
					})
					.catch(error => console.log(error))
				})
				.catch(error => console.log(error))
			}

		}
	},
	SnowflakeTime: {
		r: /^(снежинк[аи]|sftime)[.!]?$/,
		f (msg, args) {
			let totalSFTimes = []
			args.forEach(arg => {
				if (arg.match(/\d{17,20}/)) {
					let totalMatches = arg.match(/\d{17,20}/g)
					for (let i in totalMatches) {
						let d = new Date(1420070400000 + Number(totalMatches[i]) / 4194304)
						if (!d.toJSON) {
							d = new Date(d)
						}
						d.setHours(d.getHours() + 3)
						totalSFTimes.push(`${d.toJSON().split(".")[0].replace(/T/, ' ')} МСК`)
					}
				}
			})
			if (totalSFTimes) {
				msg.channel.send(totalSFTimes.join("\n"))
			}
		}
	},
	Stats: {
		r: /^(stats|статы|статистика|ап(тайм)?|up(time)?)[.!]?$/,
		v: true,
		f (msg) {
			let uptimeResult
			let u = client.uptime
			if (u > 1000) {
				let diff = u
				let tarr = [1000, 60, 60, 24]
				for (let i in tarr) {
					let x = tarr[i]
					tarr[i] = diff % x
					diff = (diff - tarr[i]) / x
				}
				tarr.push(diff)
				tarr.shift()
				let warr = [
					['секунду', 'секунды', 'секунд'],
					['минуту', 'минуты', 'минут'],
					['час', 'часа', 'часов'],
					['день', 'дня', 'дней'],
				]
				let sarr = []
				for (let i = tarr.length - 1; i >= 0; i--) {
					if (!tarr[i]) {
						continue
					}
					sarr.push(tarr[i] + ' ' + s.pluralize(tarr[i], warr[i]))
				}
				uptimeResult = `Я работаю уже ${sarr.join(', ')}.`
			} else {
				uptimeResult = `Я только зашёл.`
			}

			let subData = JSON.parse(fs.readFileSync('cinemadata.json'))
		
			const statsEmbed = {
				color: 0x888888,
				title: "Статистика",
				description: uptimeResult,
				footer: {
					text: `${process.env.npm_package_version} | 🗄 ${client.guilds.size} | 😶 ${client.emojis.size} | 👥 ${client.users.size} | 📽️ ${subData["565291444705689612"].users.length} | ⛩️ ${subData["577130367304204288"].users.length}`
				}
			}
		
			msg.channel.send({embed: statsEmbed})
		}
	},
	When: {
		r: /^(когда)[.!]?$/,
		v: true,
		f (msg, args, origCaseParams) {
			if (!args[0]) {
				return
			}
		
			let questionOriginal = origCaseParams.args.join(" ").replace(/[.!?]+$/, "")
			let question = s.getSimpleString(questionOriginal)
		
			let epochStart = 17999
			let epochEnd = 65573
			let T = epochEnd - epochStart
		
			let days = Math.floor(Math.pow(((s.hashCode(question) % T) / T), 6) * T) + epochStart
			if (question.match(/(железн(ая|ой|ую) двер(ь|и)|конец света|армагеддон|апокалипсис)/)) {
				days = epochEnd
			}
		
			let whenEmbed = {
				title: "Когда " + questionOriginal + "?",
			}
		
			let dateOptions = {year: "numeric", month: "long", day: "numeric"}
			let dateText
		
			if (days == epochStart) {
				dateText = "Сегодня."
			} else if (days == epochStart + 1) {
				dateText = "Завтра."
			} else if (days > epochEnd - 1000 && days < epochEnd) {
				dateText = "Никогда."
			} else if (question == "когда") {
				dateText = "Тогда."
			} else {
				dateText = new Intl.DateTimeFormat("ru", dateOptions).format(new Date(days*86400*1000))
			}
			whenEmbed.description = "🗓 " + dateText
		
			msg.channel.send({embed: whenEmbed})
		}
	},
	IronDoor: {
		r: /^(железнаядверь|жд)[.!]?$/,
		v: true,
		f (msg, args) {
			if (!args[0]) {
				return
			}
		
			let possibleAnswers = [
				"Бесспорно.", 
				"Определённо, да.",
				"Без сомнения.",
				"Конечно.",
		
				"Думаю, да.",
				"Наверное.",
				"Вполне вероятно.",
				"Возможно, так и есть.",
				"А сам как думаешь?",
		
				"ХЗ, вообще.",
				"Вселенная не может подсказать мне сейчас.",
				"Неясно.",
				"Попробуй сформулировать вопрос по-другому.",
				"Может быть.",
				"Не могу сейчас сказать точно.",
				"Попробуй подумать сам.",
				"Что за странный вопрос?",
				"Не могу сказать сейчас.",
				"Лучше бы тебе не знать об этом.",
				"Откуда мне знать?",
				"50 на 50.",
		
				"Скорее всего, нет.",
				"Да вряд ли.",
				"Маловероятно.",
				"Вероятность - околонулевая.",
		
				"Конечно, нет.",
				"Мои источники говорят: \"нет\".",
				"Вероятность - нулевая.",
				"Вселенная так не думает."
			]
		
			let embed = {
				author: {
					name: s.getRandomElem(possibleAnswers),
					icon_url: "https://i.imgur.com/P8IAywM.png"
				}
			}
		
			msg.channel.send({embed: embed})
		}
	},
	Three: {
		r: /^-?(\d+)[.!]?$/,
		v: true,
		f (msg, args, origCaseParams) {
			if (!args[0]) {
				args.unshift(msg.content.split(/\s+/).slice(-1)[0])
				s.autoreact(msg, args, false)
				return
			}
		
			let num = parseInt(origCaseParams.cmd)
		
			if (!num && num !== 0) {
				return
			} else if (num < 1) {
				msg.channel.send("No emoji for you!")
				return
			}
		
			let emojiName = s.getEmojiName(args[0])
			let guildName
			let guildCheck
		
			if (guildCheck = emojiName.match(/^([^:]+)(?::(\S+))$/)) {
				emojiName = guildCheck[1]
				guildName = guildCheck[2]
			}
		
			let emoji = s.findEmoji(emojiName, guildName)
		
			if (!emoji) {
				msg.react('604015450304806952')
				return
			}

			let prefix = "<:"
			let postfix = "> "
			if (emoji.animated) {
				prefix = "<a:"
			}
		
			let e = prefix + emoji.name + ":" + emoji.id + postfix
			let result = e.repeat(num)
			
			if (result.length <= 2000) {
				msg.channel.send(result)
			} else {
				msg.channel.send("Too much!")
			}
			
		}
	},
	Rtfm: {
		r: /^(rtfm|man|docs?)[.!]?$/,
		async f (msg, args, origCaseParams) {
			if (!args[0] || !args[1]) {
				msg.channel.send("Укажите в команде, какие доки вам нужны (js, py, jda) и какой метод/событие ищите.")
				return
			}
		
			let lang = args[0]
			let query = origCaseParams.args[1]
		
			let [, docsClass, docsMethod] = query.match(/^(\w+)(?:\.([\w\.]+))?/)
			docsClass = docsClass[0].toUpperCase() + docsClass.slice(1);
		
			let link
		
			if (["js", "javascript", "node", "nodejs", "discord.js"].includes(lang)) {
				link = `https://discord.js.org/#/docs/main/stable/class/${docsClass}`
				if (docsMethod) link += `?scrollTo=${docsMethod}`
			} else if (["py", "python", "discord.py"].includes(lang)) {
				if (docsClass.toLowerCase() == "commands") {
					link = `https://discordpy.readthedocs.io/en/latest/ext/commands/api.html#discord.ext.commands`
				} else if (docsClass.toLowerCase() == "tasks") {
					link = `https://discordpy.readthedocs.io/en/latest/ext/tasks/index.html#discord.ext.tasks`
				} else {
					link = `https://discordpy.readthedocs.io/en/latest/api.html#discord.${docsClass}`
				}
				if (docsMethod) link += `.${docsMethod}`
			} else if (["java", "jda"].includes(lang)) {
				let queryParts = query.split(".")
				if ( !["annotations", "bot", "core", "client", "webhook"].includes(queryParts[0]) ) {
					queryParts.unshift("core", "events")
				}
				let possibleEvent = queryParts[queryParts.length - 1]
				if (possibleEvent[0] == possibleEvent[0].toUpperCase() || possibleEvent.toLowerCase().endsWith("event")) {
					queryParts[queryParts.length - 1] = possibleEvent[0].toUpperCase() + possibleEvent.slice(1);
				} else {
					queryParts.push("package-summary")
				}
				for (let i = 0; i < queryParts.length - 1; i++) {
					queryParts[i] = queryParts[i].toLowerCase()
				}
		
				link = `https://ci.dv8tion.net/job/JDA/javadoc/net/dv8tion/jda/${queryParts.join("/")}.html`
			}
		
			try {
				await got(link).then(response => {
					let linkPartsPy = link.split("#")
					if (lang == "py" && linkPartsPy[1]) {
						if (!response.body.includes(`id=\"${linkPartsPy[1]}\"`)) throw "NotFoundError"
					} 
				})
				if (lang == "js") {
					await got("https://raw.githubusercontent.com/discordjs/discord.js/docs/stable.json").then(response => {
						if (!response.body.includes(`"path":"src/structures"}},{"name":"${docsClass}"`)) throw "NotFoundError"
						if (docsMethod) {
							if (!response.body.includes(`"path":"src/structures"}},{"name":"${docsMethod}"`)) throw "NotFoundError"
						}
					})
				}
				msg.channel.send(`📜 <${link}>`)
			} catch (err) {
				msg.channel.send(`Документации на такое нет...`)
			}
			
		}
	},
	Palette: {
		r: /^(палитра|palette)[.!]?$/,
		v: true,
		d: {
			name: "палитра + прикреплённое изображение 📎",
			value: "Считать цвета с картинки."
		},
		async f (msg, args) {
			if (!msg.attachments.size) {
				msg.channel.send("Нужно прикрепить картинку к сообщению!")
				return
			}

			let cnum = parseInt(args[0])
			if (!cnum || cnum < 1) {
				cnum = 10
			} else if (cnum > 100) {
				cnum = 100
			}
			
			msg.attachments.forEach(async (att) => {
				let max = 128
				let w = max
				let h = max
				if (att.width > att.height) {
					h = Math.round(att.height / (att.width / max))
				} else {
					w = Math.round(att.width / (att.height / max))
				}
				let imagePreview = `https://media.discordapp.net/attachments/${msg.channel.id}/${att.id}/${att.filename}?width=${w}&height=${h}`

				await s.getMainColorFromImage(imagePreview, (color, palette) => {
					let hexColors = []
					let hexRows = []

					let rowLength = 5
					let segmentW = 70
					let segmentH = 25
					let canvasW = segmentW * rowLength
					let canvasH = Math.ceil(cnum / rowLength) * segmentH

					const canvas = Canvas.createCanvas(canvasW, canvasH)
					const ctx = canvas.getContext('2d')
					for (let i = 0; i < palette.length; i++) {
						let hex = palette[i].toString(16)
						let tempHex = `00000${hex}`
						hex = `#${tempHex.slice(-6)}`
						hexColors.push(hex)
						let x = i % rowLength
						let y = Math.floor(i / rowLength)
						ctx.fillStyle = hex
						ctx.fillRect(segmentW*x, segmentH*y, segmentW, segmentH)
					}
					const buf = canvas.toBuffer('image/png')

					for (let i = 0; i < hexColors.length; i+=5) {
						hexRows.push(hexColors.slice(i, i+5).join(" "))
					}
					msg.channel.send(`\`\`\`${hexRows.join("\n")}\`\`\``, {
						files: [{
							attachment: buf,
							name: "palette.png"
						}]
					})
				}, cnum)
			})

		}
	},
	Recolor: {
		r: /^(реколор|recolor)[.!]?$/,
		v: true,
		async f (msg, args) {
			if (!args.length) {
				msg.channel.send("Нужно указать цвета! Например, `#d51a24 #7ca4af #f8dfa8 #05324a`")
				return
			}
			if (!msg.attachments.size) {
				msg.channel.send("Нужно прикрепить картинку к сообщению!")
				return
			}

			msg.channel.startTyping()

			let pal = []
			for (let i = 0; i < args.length; i++) {
				pal.push(parseInt(args[i].slice(-6), 16)*256 + 255)
			}
			msg.attachments.forEach(async (att) => {
				let max = 1024
				let w = max
				let h = max
				if (att.width > att.height) {
					h = Math.round(att.height / (att.width / max))
				} else {
					w = Math.round(att.width / (att.height / max))
				}
				let imagePreview = `https://media.discordapp.net/attachments/${msg.channel.id}/${att.id}/${att.filename}?width=${w}&height=${h}`

				await s.recolorByPalette(imagePreview, pal, buf => {
					msg.channel.send({
						files: [{
							attachment: buf,
							name: "recolored.png"
						}]
					})
					.then(() => {
						msg.channel.stopTyping()
					})
					.catch(error => {
						msg.channel.stopTyping()
						console.log(error)
					})
				})
			})

		}
	},
	Kana: {
		r: /^(kana|кана)[.!]?$/,
		v: true,
		d: {
			name: "кана <хирагана|катакана>",
			value: "Подучить кану.",
			inline: true
		},
		async f (msg, args) {
			let k = hiragana
			if (["katakana", "катакана"].includes(args[0])) {
				k = katakana
			}

			let firstQuestion = true
			let botMessage
			let isGameRunning = true

			let score = 0
			let rounds = 0
			let wrongMap = []

			let secondsToWait = 15
			if (args[1] && Number(args[1])) {
				secondsToWait = Number(args[1])
			}

			let buttons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"]
			const filter = (reaction, user) => buttons.includes(reaction.emoji.name) && user.id == msg.author.id;
			
			while (isGameRunning) {

				let con = Math.floor(k.syl.length*Math.random())
				let vow = Math.floor(k.syl[con].length*Math.random())

				let res = k.syl[con][vow]

				let pos = Math.floor(4*Math.random())

				let crow = [...kanalat[con]]
				let reslat = crow[vow]

				let opts = crow
				opts.splice(vow, 1)
				opts = s.shuffle(opts).slice(0,3)
				
				opts.splice(pos, 0, reslat)

				const embed = {
					title: res,
					description: `${opts.join(" ").toUpperCase()} \n\nУ вас ${secondsToWait} секунд!\n[Шпаргалка](https://docs.google.com/spreadsheets/d/1GdpF_ameYIvhFTT2Ji_MNisDS7qCLENoxMllR59q6Zg/edit?usp=drivesdk)`,
					footer: {
						icon_url: msg.author.avatarURL,
						text: `${msg.author.tag} - ${score}/${rounds}`
					}
				}
				
				if (firstQuestion) {
					await msg.channel.send({embed: embed}).then(async (m) => {
						firstQuestion = false
						botMessage = m

						for (let i = 0; i < 4; i++) {
							await m.react(buttons[i])
						}
					})
					.catch(error => console.log(error))
				} else {
					await botMessage.edit({embed: embed})
				}
				
				await botMessage.awaitReactions(filter, { max: 1, time: secondsToWait*1000 })
					.then(collected => {
						const reaction = collected.first()
						if (botMessage.channel.type == "text" && botMessage.member.hasPermission('MANAGE_MESSAGES')) {
							reaction.remove(msg.author.id)
						}
						if (buttons.indexOf(reaction.emoji.name) == pos) {
							score++
						} else {
							wrongMap[con] = []
							wrongMap[con][vow] = true
						}
					})
					.catch(collected => {
						isGameRunning = false
						let wrongGuesses = []
						for (let i = 0; i < wrongMap.length; i++) {
							if (wrongMap[i]) {
								for (let j = 0; j < wrongMap[i].length; j++) {
									if (wrongMap[i][j]) {
										wrongGuesses.push(`${k.syl[i][j]} ||${kanalat[i][j]}||`)
									}
								}
							}
						}
						let gameoverText = "Время вышло!"
						if (wrongGuesses.length) {
							gameoverText += ` \nПодучить: ${wrongGuesses.join(" ")}`
						}
						msg.reply(gameoverText)
					});

				rounds++
			}	

		}
	},
	Jwords: {
		r: /^(jwords|jlpt|kanji|кан(д?[жз])и)[.!]?$/,
		v: true,
		d: {
			name: "kanji [seconds]",
			value: "JLPT N5 vocabulary test!",
			inline: true
		},
		async f (msg, args) {

			let isGameRunning = true
			if (msg.channel.type == "dm") {
				userDB[msg.author.id].learningKanji = true
			}

			let firstQuestion = true
			let botMessage
			let userAnswerMessage
			let gameChannel = msg.channel

			let messageForPreviousGuess = 'Let\'s begin!'

			let score = 0
			let rounds = 0
			let wrongSet = new Set()

			let secondsToWait = 60
			if (args[0] && Number(args[0])) {
				secondsToWait = Number(args[0])
			}

			const newWordsToAddCount = 5
			const timesToAnswer = 5
			const timesToShowHint = 2

			const canh = 200
			const textRatio = 0.8
			const cardFontSize = Math.ceil(canh*textRatio)

			const filter = (m) => m.author.id == msg.author.id;

			let userPath = `jap_users/${msg.author.id}.json`
			let userData
			if (fs.existsSync(userPath)) {
				userData = JSON.parse(fs.readFileSync(`jap_users/${msg.author.id}.json`))
			} else {
				userData = {
					"studied": [],
					"problemed": {}
				}
			}

			let studied = new Set(userData.studied)

			while (isGameRunning) {

				let num
				let probArr = Object.keys(userData.problemed)

				if (!probArr.length || (studied.size + probArr.length) % newWordsToAddCount) {
					num = Math.floor(Math.random() * kanji.length)
				} else {
					if (Math.random() > 0.2 || !studied.size) {
						num = s.getRandomElem(probArr)
					} else {
						num = s.getRandomElem(Array.from(studied))
					}
				}

				let k = kanji[num]

				let hir = [...hiragana.syl]
				hir.push('ゃゅょ')
				let kat = [...katakana.syl]
				kat.push('ャュョ')
				let lat = [...kanalat]
				lat.push(['ya', 'yu', 'yo'])

				let romaji = []

				for (let i = 0; i < k.r.length; i++) {
					let rvar = k.r[i]
					let rvarRomaji = ''
					let tsuRepeating = false
					for (let j = 0; j < rvar.length; j++) {
						if (['っ', 'ッ'].includes(rvar[j])) {
							tsuRepeating = true
							continue;
						}
						if (rvar[j] == 'ー') {
							rvarRomaji += rvarRomaji.slice(-1)
							continue;
						}
						for (let x = 0; x < hir.length; x++) {
							for (let y = 0; y < hir[x].length; y++) {
								if ([hir[x][y], kat[x][y]].includes(rvar[j])) {
									if (tsuRepeating) {
										rvarRomaji += lat[x][y][0]
										tsuRepeating = false
									}
									if (x == hir.length - 1) { // check if it's lowered vowel
										if (rvarRomaji.slice(-1) != 'n') {
											rvarRomaji = rvarRomaji.slice(0, -1)
										}
										if (rvarRomaji.match(/(sh|ch|j)$/)) {
											rvarRomaji += lat[x][y][1]
										} else {
											rvarRomaji += lat[x][y]
										}
									} else {
										rvarRomaji += lat[x][y]
									}
								}
							}
						}
					}
					romaji.push(rvarRomaji)
				}

				// canvas start

				const canw = k.s.length*cardFontSize + (canh - cardFontSize)

				const canvas = Canvas.createCanvas(canw, canh)
				const ctx = canvas.getContext('2d')
	
				let { body: imageInfo } = await got(`https://neko-love.xyz/api/v1/neko`, { json: true })
				if (imageInfo.error) throw Error(imageInfo.error)
				const bg = await Canvas.loadImage(imageInfo.url)
	
				const bgw = bg.width
				const bgh = bg.height
	
				const bgRatio = bgw/bgh
				const canvasRatio = canw/canh
	
				if (bgRatio < canvasRatio) {
					ctx.drawImage(bg, 0, (bgh-bgw/canvasRatio)/2, bgw, bgw/canvasRatio, 0, 0, canw, canh)
				} else {
					ctx.drawImage(bg, (bgw-bgh*canvasRatio)/2, 0, bgh*canvasRatio, bgh, 0, 0, canw, canh)
				}
				
	
				ctx.font = `${cardFontSize}px "KosugiMaru"`
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.fillStyle = 'rgba(114, 137, 218, 0.3)';
				ctx.fillRect(0, 0, canw, canh);
				ctx.fillStyle = 'white'
				ctx.fillText(k.s, canw/2, canh/2)
				ctx.strokeStyle = 'black';
				ctx.lineWidth = 1;
				ctx.strokeText(k.s, canw/2, canh/2);
				const buf = canvas.toBuffer('image/png')
				
				// canvas end

				let hintText = `${k.r.join(", ")}, ${k.m[0]}`
				if (studied.has(num) || userData.problemed[num] >= timesToShowHint) {
					hintText = `||\` ${hintText} \`||`
				}

				const embed = {
					title: messageForPreviousGuess,
					description: `You have ${secondsToWait} seconds!\n[jisho](https://jisho.org/search/${k.s}) \n\n${hintText}`,
					image: {
						url: 'attachment://neko.png'
					},
					footer: {
						icon_url: msg.author.avatarURL,
						text: `${msg.author.tag} - ${score}/${rounds}`
					}
				}

				let botmsgToDelete = botMessage
				await gameChannel.send({
					embed: embed,
					files: [{
						attachment: buf,
						name: 'neko.png'
					}]
				}).then(async (m) => {
					botMessage = m
					gameChannel.stopTyping()
				})
				.catch(error => console.log(error))

				if (!firstQuestion && s.deleteUserMessage(userAnswerMessage, 0)) {
					await botmsgToDelete.delete()
				} else {
					firstQuestion = false
				}
				
				await gameChannel.awaitMessages(filter, { max: 1, time: secondsToWait*1000 })
					.then(collected => {
						gameChannel.startTyping()
						const m = collected.first()
						userAnswerMessage = m
						if (k.r.includes(m.content) || romaji.includes(m.content) || k.m.includes(m.content)) {
							score++
							messageForPreviousGuess = `Right!`

							if (!studied.has(num)) {
								let p = userData.problemed[num]

								p = (p) ? ++p : 1
								
								if (p >= timesToAnswer) {
									studied.add(num)
									delete userData.problemed[num]
								} else {
									userData.problemed[num] = p
								}
							}
							
						} else {
							wrongSet.add(k.s)
							messageForPreviousGuess = `Nope.`

							userData.problemed[num] = 0
							studied.delete(num)
						}
					})
					.catch(collected => {
						isGameRunning = false
						gameChannel.stopTyping()
						userDB[msg.author.id].learningKanji = false
						const gameoverEmbed = {
							title: "Time's up!"
						}
						if (rounds) {
							gameoverEmbed.description = `Result: ${(score/rounds*100).toFixed(2)}%`
							if (wrongSet.size) {
								gameoverEmbed.description += ` \nTo learn: \n${Array.from(wrongSet).map(x=>'['+x+']'+'(https://jisho.org/search/'+x+')').join("　")}`
							}
						}

						msg.reply({embed: gameoverEmbed})

						userData.studied = Array.from(studied)
						fs.writeFile(userPath, JSON.stringify(userData, null, 4), err => {
							if (err) {
								console.log("error on writing to file!")
							}
						})
					});

				rounds++
			}	

		}
	},
	Sub: {
		r: /^((un)?sub|(ан)?саб)[.!]?$/,
		v: false,
		async f (msg, args, origCaseParams) {
			if (!args[0]) {
				return
			}
			let isUserSubbing = true
			if (origCaseParams.cmd.match(/^(unsub|ансаб)/)) {
				isUserSubbing = false
			}
			let subTarget
			switch (args[0]) {
				case "кино":
				case "kino":
					subTarget = "565291444705689612"
					break;
				case "аниме":
				case "anime":
					subTarget = "577130367304204288"
					break;
				default:
					break;
			}
			let data = JSON.parse(fs.readFileSync('cinemadata.json'))
			let users = new Set(data[subTarget].users)
			let subName = data[subTarget].name
			let uid = msg.author.id
			if (isUserSubbing) {
				if (users.has(uid)) {
					msg.reply(`Вы уже подписаны на ${subName}!`)
				} else {
					users.add(uid)
					data[subTarget].users = Array.from(users)
					fs.writeFile("cinemadata.json", JSON.stringify(data, null, 2), err => {
						if (!err) {
							msg.reply(`Теперь вы подписаны на ${subName}!`)
						}
					})
				}
			} else {
				if (!users.has(uid)) {
					msg.reply(`Вы и так не подписаны на ${subName}!`)
				} else {
					users.delete(uid)
					data[subTarget].users = Array.from(users)
					fs.writeFile("cinemadata.json", JSON.stringify(data, null, 2), err => {
						if (!err) {
							msg.reply(`Теперь вы отписаны от ${subName}!`)
						}
					})
				}
			}
		}
	},
	Dividers: {
		r: /^(dividers|разложи|primecheck)[.!]?$/,
		v: false,
		f (msg, args) {
			if (!args[0]) {
				msg.channel.send('Введите число!')
				return
			}
			
			let start = new Date()
			let a = args[0]

			// code below by PLAYER_CHAR https://chaoscraft.ml/tools/numbers/

			if (a.match(/e/i)) {
				// экспоненциальная запись неудобна для проверки
				msg.channel.send('Введите число в обычной форме!')
				return
			}

			// если это десятичная дробь, то считаем десятки в минус
			let ten = 0
			let parts = a.split('.')
			let ns = parts[0]
			if (parts[1]) {
				let frac = parts[1].replace(/0+$/, '')
				ns += frac
				ten = frac.length
			}

			// z - целое число, k - число для вывода в конце
			let z = +ns
			let k = String(z / Math.pow(10, ten))

			if (!isFinite(z)) {
				// ввели бред
				msg.channel.send('Ты втираешь мне какую-то дичь')
				return
			}
			if (!Number.isSafeInteger(Math.floor(z))) {
				// число большое, оно может округлиться
				if (ten) {
					msg.channel.send('Слишком много цифр, будут ошибки в округлении')
				} else {
					msg.channel.send('Число слишком большое')
				}
				return
			}

			// тривиальные варианты
			if (z == 0) {
				msg.channel.send('Введите число, отличное от нуля')
				return
			}
			if (z == 1) {
				msg.channel.send('1 не имеет простых делителей')
				return
			}

			// p - ассоциативный массив простых чисел
			// число "-1" в нём сортируется отстойно, сдвинем всё на единицу
			let p = {}

			// если z отрицательное, то кидаем сразу -1
			if (z < 0) {
				// да-да, мы сдвинули, 0 означает "-1"
				p[0] = 1
				z *= -1
			}

			// проверка, делится ли n на l
			function divable(n, l) {
				let s = n / l
				return (s == Math.trunc(s))
			}

			// процедура деления z на n
			function div(n) {
				if (n > s) {
					// дальше корня ничего не будет
					if (z != 1) {
						// выделяем оставшееся простое число
						p[z + 1] = 1
					}
					// всё, доделились
					throw 0
				}
				if (divable(z, n)) {
					// если делится, то делим
					let l = 0
					do {
						// делим его на n, пока делится
						l++
						z /= n
					} while (divable(z, n))
					
					// записываем результат
					p[n + 1] = l
					if (z < 2) {
						// всё, доделились
						throw 0
					}
					s = Math.floor(Math.sqrt(z))
				}
			}

			// n - текущее простое число
			let n = 3
			// s - предельное значение
			let s = Math.floor(Math.sqrt(z))

			// делим, пока не выделится всё
			try {
				// двойку проверяем отдельно
				div(2)
				while (true) {
					// далее тупо проверяем все нечётные
					div(n)
					n += 2
				}
				// под конец div() рано или поздно выкинет исключение
			} catch(e) {}

			// расплачиваемся, если это была десятичная дробь
			if (ten) {
				// двойки
				p[3] = p[3] ? p[3] - ten : -ten
				// пятёрки
				p[6] = p[6] ? p[6] - ten : -ten
			}

			const powers = "⁰¹²³⁴⁵⁶⁷⁸⁹"
			let result

			// теперь выписываем всё это
			let str = ''
			for (n in p) {
				if (!p[n]) {
					// если 0.5 и тому подобное, то появится 5^0, которое не нужно
					continue
				}
				if (str) {
					// знак умножения между множителями
					str += ' × '
				} else
				if (n - 1 == k) {
					// если число простое
					result = k + ' - простое число'
				}
				// приписываем множитель
				str += n - 1
				// пишем его степень
				if (p[n] != 1) {
					str += Array.from((p[n]).toString()).map(x => powers[x] ? powers[x] : '⁻').join("")
				}
			}
			result = (result) ? result : k + ' = ' + str

			let end = new Date()

			let resultEmbed = {
				title: result,
				footer: {
					text: `Вычислено за ${end - start} мс`
				}
			}

			msg.channel.send({embed: resultEmbed})

		}
	},
	Uwuify: {
		r: /^((uwu|owo)ify)[.!]?$/,
		v: false,
		f (msg, args) {
			if (!args[0]) {
				msg.channel.send('pwewase ewntew sowme tewxt uwu')
				return
			}

			let t = args.join(" ")
			t = t.replace(/th([aiueo])/g, 'd$1')
			t = t.replace(/[rl]/g, 'w')
			t = t.replace(/([aiueo])t/g, '$1wt')
			t = t.replace(/\!/g, ' uwu')
			t = t.replace(/\'/g, '')

			msg.channel.send(t)
		}
	},
	Coffee: {
		r: /^(кофе|coff?ee?)[.!]?$/,
		v: true,
		async f (msg, args, origCaseParams) {

			let botMessage
			let foamImageURL = msg.author.avatarURL

			await msg.channel.send("Начинаю варить...").then(async (m) => {
				botMessage = m
			})

			let nick = (msg.channel.type == "text") ? msg.member.displayName : msg.author.username

			if (msg.attachments.size) {
				let att = msg.attachments.first()
				if (att.width) { // test if att is an image
					foamImageURL = att.url
				}
			} else if (origCaseParams.args[0]) {
				foamImageURL = origCaseParams.args[0]
			}

			const canvas = Canvas.createCanvas(1280, 853)

			function findIndex256(arr, v) {
				let a = 0
				let b = 256
				while (b - a > 1) {
					let c = (a + b) >> 1
					if (arr[c] < v) {
						a = c
					} else {
						b = c
					}
				}
				return a
			}

			const imc = new Image()
			imc.src = "https://cdn.discordapp.com/attachments/602935027306856449/665937097588473868/5RhrSmC0NHE.png"
			imc.onload = async () => {
				const imb = new Image()
				imb.src = foamImageURL
				imb.onload = async () => {
					try {
						botMessage.edit("Почти готово...")
					} catch (err) {}

					let x0 = 152
					let x1 = 715
					let y0 = 270
					let y1 = 520
					let w = x1 - x0
					let h = y1 - y0

					const sw = imb.width
					const sh = imb.height
					const sR = (sw/sh < 1) ? true : false

					const sx = (sR) ? 0 : (sw-sh)/2
					const sy = (sR) ? (sh-sw)/2 : 0
					const sWidth = (sR) ? sw : sh
					const sHeight = (sR) ? sw : sh
					
					let cuptop = canvas
					cuptop.width = w
					cuptop.height = h
					let cuptopbm = cuptop.getContext('2d')
					cuptopbm.filter = 'blur(1.1px)'
					cuptopbm.drawImage(imb, sx, sy, sWidth, sHeight, 0, 0, w, h)
					cuptopbm.filter = 'none'
					cuptopbm.globalAlpha = 0.5
					cuptopbm.drawImage(imb, sx, sy, sWidth, sHeight, 0, 0, w, h)
					cuptopbm.globalAlpha = 1
					let data = cuptopbm.getImageData(0, 0, w, h)
					let dat = data.data
					
					let counts = new Float64Array(256)
					let counttotal = 0.0
					
					for (let j = 0; j < h; j++) {
						for (let i = 0; i < w; i++) {
							// compute dist from center
							let o = (i + j * w) << 2
							let x = ((i + 0.5) / w) * 2 - 1
							let y = ((j + 0.5) / h) * 2 - 1
							let r2 = x * x + y * y
							// set opacity
							let q = r2 > 1 ? 0.0 : 1 - 3 * r2 ** 24 + 2 * r2 ** 36
							let opacity = dat[o + 3] * q
							dat[o + 3] = Math.round(opacity)
							
							// count
							counttotal += opacity
							counts[Math.round(dat[o] * 0.4 + dat[o + 1] * 0.4 + dat[o + 2] * 0.2)] += opacity
						}
					}
					let countsum = 0.0
					for (let i = 0; i < 256; i++) {
						countsum += counts[i] / counttotal
						counts[i] = countsum
					}
					let min = findIndex256(counts, 0.01) / 256
					let med = findIndex256(counts, 0.50) / 256
					let max = findIndex256(counts, 0.95) / 256
					let median = ((min + 2 * med + max) / 4 - min) / (max - min)
					
					for (let j = 0; j < h; j++) {
						for (let i = 0; i < w; i++) {
							let o = (i + j * w) << 2
							if (dat[o + 3] == 0) {
								continue
							}
							// recolor
							
							let l = (dat[o] * 0.4 + dat[o + 1] * 0.4 + dat[o + 2] * 0.2) / 256
							//l = (l - min) / (max - min)
							l = l + (1 - max)
							l = Math.max(Math.min(l, 1), 0)
							l = l ** median
							
							let currRandom = 0
							for (let k = 0; k < 40; k++) {
								currRandom += Math.random()
							}
							currRandom = (currRandom - 20) / 10
							l = Math.max(Math.min(1, l + 0.07 * currRandom), 0)
							
							let r = 0.25 + 0.65 * (1 - (1 - l) ** 1.5)
							let g = 0.07 + 0.85 * l ** 1.25
							let b = l ** 3
							
							dat[o + 0] = Math.round(r * 255)
							dat[o + 1] = Math.round(g * 255)
							dat[o + 2] = Math.round(b * 255)
						}
					}
					
					cuptopbm.putImageData(data, 0, 0)
					
					let result = Canvas.createCanvas(1280, 853)
					result.width = imc.naturalWidth
					result.height = imc.naturalHeight
					let resultbm = result.getContext('2d')
					resultbm.drawImage(imc, 0, 0)
					resultbm.drawImage(cuptop, x0, y0, w, h)
					
					const buf = result.toBuffer('image/png')
					msg.channel.send(`Ваш кофе готов, ${nick}. Прошу... <:hatKid:562284260149428224>`, {
						files: [{
							attachment: buf,
							name: "coffee.png"
						}]
					}).then(async () => {
						botMessage.delete()
					})
				}
				imb.onerror = err => { 
					msg.channel.send("Ошибка с картинкой!")
					throw err 
				}
			}
			imc.onerror = err => { throw err }

		}
	}
}
