import Discord from "discord.js"
export const client = new Discord.Client()

import dotenv from "dotenv"
dotenv.config()
const TOKEN = process.env.BOT_TOKEN
export const OWNER_ID = process.env.OWNER_ID
export let BOT_ID
export let BOT_PREFIX

if (!(TOKEN && OWNER_ID)) {
	console.log("Can't get some env variable!")
	console.log("TOKEN: " + (TOKEN ? TOKEN.substring(0, 10) + "..." : "not found"))
	console.log({OWNER_ID})
}

import * as s from "./secondary"
import {commands} from "./commands"
import {simpleAnswers} from "./simpleAnswers"
import {timeOptions} from "./config"

export const readyTime = Date.now()
export let visibleServers = []
export let requestsCounter = 0

function processMessage(msg) {

	// для логов
	let dateOptions = {
		month: "2-digit",
		day: "2-digit"
	}

	// если юзер отправил в лс картинку-аттачмент
	let isSentImageHere = false
	if (msg.channel.type == "dm") {
		msg.attachments.forEach(att => {
			commands.Send.f(msg, null, `send ${att.url} ${msg.content.replace(/\s+/g, " ")}`)
			isSentImageHere = true
		})
	}
	if (isSentImageHere) {
		requestsCounter++
		s.sentLog(msg, msg.cleanContent, Object.assign(dateOptions, timeOptions))
		return
	}

	// обработка сообщения
	let componentsOriginal = msg.content.split(/\s+/)
	let components = s.getSimpleString(msg.content).split(/\s+/)
	let msgCommandOriginal
	let msgCommand

	// проверка сообщения на наличие команды
	if (components[0].match(BOT_PREFIX) && components.length > 1) {
		componentsOriginal.shift()
		msgCommandOriginal = componentsOriginal.join(" ")
		components.shift()
		msgCommand = components.join(" ")
	} else if (msg.channel.type != "text") {
		msgCommandOriginal = msg.content.replace(/\s+/g, " ")
		msgCommand = s.getSimpleString(msg.content)
		if (components[0].match(/^http.+\.(png|jpe?g|bmp|gif|webp)/)) {
			let url = componentsOriginal[0]
			componentsOriginal.shift()
			commands.Send.f(msg, null, `send ${url} ${componentsOriginal.join(" ")}`)
			return
		}
	} else {
		return
	}

	// если всё ок, продолжаем...
	requestsCounter++
	s.sentLog(msg, msg.cleanContent.replace(/\s+/g, " "), Object.assign(dateOptions, timeOptions))

	// поделить запрос на "основную команду" и аргументы
	let args = msgCommand.split(/\s+/)
	let cmd = args.shift()

	// ищем команду в регулярках
	for (let i in commands) {
		if (cmd.match(commands[i].r)) {
			if (commands[i].v && !s.isThisBotsChannel(msg)) {
				msg.react("#⃣")
					.then(() => {
						msg.react("🤖")
					})
					.catch(error => console.log(error))
			} else {
				commands[i].f(msg, args, msgCommandOriginal)
			}
			return
		}
	}

	// "общение"
	for (let i of simpleAnswers) {
		if (msgCommand.match(i.r)) {
			if (i.e) {
				msg.react(s.getRandomElem(i.e))
			} else if (i.t) {
				msg.channel.send(s.getRandomElem(i.t))
			}
			return
		}
	}

	// если запрос не соответствует ни одной из команд, попробовать автореакцию
	args.unshift(cmd)
	s.autoreact(msg, args, true)
}
client.on('ready', () => {

	// для логов
	let dateOptions = {
		weekday: "long",
		year: "numeric",
		month: "short",
		day: "numeric"
	}

	let readyTimeString = new Date(readyTime).toLocaleString("ru", Object.assign(dateOptions, timeOptions))
	console.log(`${client.user.tag} entered Discord \non ${readyTimeString}\n`)

	client.user.setPresence({game: {name: "sb help", type: 0}})
	BOT_ID = client.user.id
	BOT_PREFIX = new RegExp(`^(?:[сcs][бb6]|сбот|стилл?бот|sbot|still?bot|<@\!?${BOT_ID}>),?$`)

	// кэширование сообщений для реакций и сбор айдишников серверов
	client.guilds.forEach(guild => {
		if (guild.emojis.size) {
			visibleServers.push(guild.id)
		}
		guild.channels.forEach(channel => {
			if (channel.type == "text") {
				if (channel.permissionsFor(client.user).has("READ_MESSAGES")) {
					channel.fetchMessages({limit: 5})
						.then(() => {})
						.catch(error => console.log(error))
				}
			}
		})
	})

	visibleServers = visibleServers.sort((a, b) => {
		return parseInt(a) - parseInt(b);
	});

})
client.on('message', msg => {
	if (msg.author.id == BOT_ID) return
	// processMessage(msg)
	setTimeout(processMessage, 50, msg)
})
function actionsForReactions(messageReaction, user, wasReactionAdded) {
	let msg = messageReaction.message
	let msgReaction = messageReaction.emoji.name

	if (msg.content.startsWith("Доступные эмоджи:") && ["⬅", "➡"].includes(msgReaction)) {
		// check emojilist reaction
		if (msg.author.id == BOT_ID && user.id != BOT_ID) {
			let turn = ""
			if (msgReaction == "⬅") {
				turn = "-"
			} else if (msgReaction == "➡") {
				turn = "+"
			}
			commands.EmojiList.f(msg, [turn], false, true)
		}
	} else {
		// check homestuck reaction
		let msg = messageReaction.message
		let msgReaction = messageReaction.emoji.name
	
		if (["⬅", "➡"].includes(msgReaction) && msg.author.id == BOT_ID && user.id != BOT_ID) {
			let msg = messageReaction.message
			let cMatch, eMatch, page_number, page_to_go
			if (cMatch = msg.content.match(/hs#(\d+)/)) {
				page_number = Number(cMatch[1])
			} else if (msg.embeds[0] && (eMatch = msg.embeds[0].author.name.match(/hs#(\d+)/))) {
				page_number = Number(eMatch[1])
			}
	
			if (page_number) {
				if (msgReaction == "➡") {
					page_to_go = page_number + 1
				} else if (msgReaction == "⬅") {
					page_to_go = page_number - 1
				}
				commands.Homestuck.f(msg, [page_to_go], null, true)
			}
	
		}
	}
}
client.on('messageReactionAdd', (messageReaction, user) => {
	let msg = messageReaction.message
	let msgReaction = messageReaction.emoji.name

	if (s.checkReactionForAutoreact(messageReaction, user)) {
		return
	} else if (msgReaction == "❌" && [BOT_ID, OWNER_ID].includes(msg.author.id) && user.id == OWNER_ID) {
		if (msg.channel.id != "526441608250392577") {
			msg.delete(300)
		}
	} else {
		actionsForReactions(messageReaction, user, true)
	}
})
client.on('messageReactionRemove', (messageReaction, user) => {
	actionsForReactions(messageReaction, user, false)
})
client.on('guildCreate', (guild) => {
	if (guild.emojis.size) {
		visibleServers.push(guild.id)
	}
})
client.on('guildDelete', (guild) => {
	let index = visibleServers.indexOf(guild.id)
	if (index) {
		visibleServers.splice(index, 1)
	}
})
client.on('guildMemberAdd', member => {
	if (member.guild.id == "540145900526501899") {
		let welcomeLines = [
			`Какой-то ПЕК-НЕК ${member} зашёл к нам на чай! <:peckneck:574889131826479104>`,
			`Добро пожаловать в наш филиал #творчества, ${member}! <a:metaThinking:552849453493649412>`,
			`${member}, какова цель вашего визита? Покажите визу <:tanyaVisa:579028733306863617>`
		]
		let channel = client.channels.get("540145900979355658")
		let welcomeRandom = s.getRandomElem(welcomeLines)
		if (member.user.bot) {
			member.addRole("600294051962421258")
				.then(() => {})
				.catch(error => console.log(error))
			channel.send(welcomeRandom + `\nБоты живут тут - <#600294780144189481>`)
		} else {
			channel.send(welcomeRandom + `\nРоль для киношек можно получить тут - <#565292229657100289>`)
		}
		
	}
})
client.on('guildMemberRemove', member => {
	if (member.guild.id == "540145900526501899") {
		let channel = client.channels.get("540145900979355658")
		channel.send(`<:F_:552885803550769162> ${member.user.tag}`);
	}
})

function login() {
    client.login(TOKEN).catch(() => setTimeout(login, 5000))
}
login()
