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
import {timeOptions, dateOptions} from "./config"

export let visibleServers = []
export let requestsCounter = 0
export let messagesCounter = 0

let userDB = {}
const floodRate = 5 * 1000; 
const floodMax = 20 * 1000; 
const floodChillsMax = 2;

function processMessage(msg) {

	// разбиение сообщения на компоненты
	let componentsOriginal = msg.content.split(/\s+/)
	let components = s.getSimpleString(msg.content).split(/\s+/)
	let isPrefixThere = components[0].match(BOT_PREFIX)
	let msgCommandOriginal
	let msgCommand

	// проверка сообщения на наличие команды
	if (!isPrefixThere && msg.channel.type == "text") {
		return
	}

	// отлично, юзер обращается именно к боту, идём дальше...

	// выявление команды и аргументов из сообщения
	if (isPrefixThere) {
		componentsOriginal.shift()
		components.shift()
	}
	if (components[0].match(BOT_PREFIX) && components.length > 1) {
		msgCommandOriginal = componentsOriginal.join(" ")
		msgCommand = components.join(" ")
	} else if (msg.channel.type != "text") {
		msgCommandOriginal = msg.content.replace(/\s+/g, " ")
		msgCommand = s.getSimpleString(msg.content)
		if (components[0].match(/^http.+\.(png|jpe?g|bmp|gif|webp)/)) {
			let url = componentsOriginal[0]
			componentsOriginal.shift()
			commands.Send.f(msg, null, `send ${url} ${componentsOriginal.join(" ")}`)
			return
		} else {
			// если юзер отправил в лс картинку-аттачмент
			let isSentImageHere = false
			if (msg.channel.type == "dm" && !["палитра", "palette"].includes(msg.content)) {
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
		}
	} else {
		return
	}


	// antiflood system by PLAYER_CHAR
	const now = Date.now()
	const uid = msg.author.id
	
	if (!userDB[uid]) {
		userDB[uid] = {
			ftime: -Infinity, // таймстемп ожидания флуда
			fchills: 0, // предупреждений за текущий акт флуда
		}
	}
	const udata = userDB[uid]
	
	let score = udata.ftime - now
	if (score < 0) {
		udata.fchills = 0
		score = 0
	}
	score += floodRate
	udata.ftime = now + score
	
	if (udata.fchills >= floodChillsMax) {
		return
	}
	if (score > floodMax) {
		if (udata.fchills == floodChillsMax - 1) {
			console.log(`${msg.author.tag} is flooding now!!`)
			msg.channel.send(s.getRandomElem([
				"🙅 СТОП! ✋ СТОЯТЬ! ⛔ \n🕑 Время флуда закончилось! 🕑",
				"Дудос проведён успешно! <:sho:355426437639176194>",
				"CPU usage 🔥 JUMPS 📈 to 100% \n❄ Initiating cooling system... ❄"
			]))
		} else {
			msg.channel.send(s.getRandomElem([
				"Постой! Не так быстро.",
				"no flood allowed here",
				"<:cracker:357960229259837440> <:SPAM:533333156644913152>"
			]))
		}
		udata.fchills++
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

	let readyTimeString = new Date(client.readyTimestamp).toLocaleString("ru", Object.assign(dateOptions, timeOptions))
	console.log(`${client.user.tag} entered Discord \non ${readyTimeString}\n`)

	client.user.setPresence({game: {name: `${process.env.BOT_SHORT_NAME} help`, type: 0}})
	BOT_ID = client.user.id
	BOT_PREFIX = new RegExp(`^(?:${process.env.ACCEPTABLE_BOT_NICKNAME}|<@\!?${BOT_ID}>),?$`)

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
	if (msg.author.bot) return
	processMessage(msg)
	messagesCounter++
	let um = messagesCounter - requestsCounter
	if (um % 1000 == 0) console.log(`| ${(new Date).toLocaleString("ru", Object.assign(dateOptions, timeOptions))} | Useless messages: ${um}`)
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
	console.log(`Bot was added to ${guild.name} (${guild.id})`)
})
client.on('guildDelete', (guild) => {
	let index = visibleServers.indexOf(guild.id)
	if (index) {
		visibleServers.splice(index, 1)
	}
	console.log(`Bot was kicked from ${guild.name} (${guild.id})`)
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
		channel.send(`<:f_:604654351591407617> ${member.user.tag}`);
	}
})

function login() {
    client.login(TOKEN).catch(() => setTimeout(login, 5000))
}
login()
