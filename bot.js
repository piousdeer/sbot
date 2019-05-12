// подключаем модули
require('http').createServer().listen(3000)
import Discord from "discord.js"
export const client = new Discord.Client()

// переменные внешней среды
require('dotenv').config()
const TOKEN = process.env.BOT_TOKEN
export const OWNER_ID = process.env.OWNER_ID

if (!(TOKEN && OWNER_ID)) {
	console.log("Can't get some env variable!")
	console.log("TOKEN: " + (TOKEN ? TOKEN.substring(0, 10) + "..." : "not found"))
	console.log({OWNER_ID})
}

export const readyTime = Date.now()
export const dateOptions = {
	weekday: "long",
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
	timeZone: "Europe/Moscow"
}
export let BOT_ID

import * as s from "./secondary"
import * as c from "./commands"
import {commandsRegExp, simpleAnswers} from "./aliases"

let visibleServers = []
export let requestsCounter = 0

// что делать в ответ на сообщение
function processMessage(msg) {
	// если юзер отправил в лс картинку-аттачмент
	let isSentImageHere = false
	if (msg.channel.type == "dm") {
		msg.attachments.forEach(att => {
			c.Send(msg, null, `send ${att.url} ${msg.content}`)
			isSentImageHere = true
		})
	}
	if (isSentImageHere) {
		return
	}

	// обработка сообщения
	let msgoc = msg.content.replace(/\n/g, " ").replace(/ +/g, " ")
	let msglc = msgoc.toLowerCase().replace(/ё/g, "е")
	let msgCommandOriginal
	let msgCommand
	let msglcDivided

	// проверка сообщения на наличие команды
	if (msglcDivided = msglc.match(new RegExp("^(?:[сc][бb6]|сбот|стилл?бот|sb|sbot|still?bot|<@" + BOT_ID + ">)" + ",? (.+)$"))) {
		msgCommandOriginal = msgoc.match(/^\S+ (.+)$/)[1]
		msgCommand = msglcDivided[1]
	} else if (msg.channel.type != "text") {
		msgCommandOriginal = msgoc
		msgCommand = msglc
	} else {
		return
	}

	// only allowed RC channels!
	/*
	if (msg.channel.type == "text" && msg.channel.guild.id == "110107304413638656" && !(["519609441109147655","521683316899053596","334369998866874369", "541594001992581122"].includes(msg.channel.id))) {
		 return
	}
	*/

	// если всё ок, продолжаем...
	requestsCounter++

	// отослать текст запроса в логи
	let serverWhereUserIs = "Direct Messages"
	if (msg.channel.type == "text") {
		serverWhereUserIs = (msg.channel.guild.name + " (" + msg.channel.guild.id + ")")
	}
	console.log((new Date).toLocaleString("ru", dateOptions) + "\nFrom " + serverWhereUserIs + ":\n" + msg.author.id + " | " + msg.author.tag + ": " + msg.content)

	// поделить запрос на "основную команду" и аргументы
	let args = msgCommand.split(" ")
	let cmd = args.shift()

	// ищем команду в регулярках
	for (let i of commandsRegExp) {
		if (cmd.match(i.r)) {
			i.f(msg, args, msgCommandOriginal)
			return
		}
	}

	// "общение"
	for (let i of simpleAnswers) {
		if (msgCommand.match(i.r)) {
			if (i.e) {
				msg.react(i.e)
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
function actionsForReactions(messageReaction, user, wasReactionAdded) {
	let msg = messageReaction.message
	let msgReaction = messageReaction.emoji.name

	if (["📽", "⛩", "🎮"].includes(msgReaction) && msg.id == "565292786514133012") {
		s.setCinemaRole(user, wasReactionAdded, msgReaction)
	} else if (msg.content.startsWith("Доступные эмоджи:") && ["⬅", "➡"].includes(msgReaction)) {
		s.checkEmojiListReaction(msgReaction, user, msg, visibleServers)
	} else {
		s.checkHomestuckReaction(messageReaction, user)
	}
}

// действия непосредственно после запуска бота
client.on('ready', () => {

	let readyTimeString = new Date(readyTime).toLocaleString("ru", dateOptions)
	console.log(client.user.tag + " entered Discord on " + readyTimeString)

	client.user.setPresence({game: {name: "sb help", type: 0}})
	BOT_ID = client.user.id

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

	// кэширование реакций кинотеатра
	let cinema = client.channels.get("541594001992581122")
	if (cinema) {
		cinema.fetchMessage("542389154424553549")
			.then(() => {})
			.catch(error => console.log(error))
	}

})
client.on('message', msg => {
	if (msg.author.id == BOT_ID) return
	// processMessage(msg)
	setTimeout(processMessage, 50, msg)
})
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

// подключение к Дискорду
function login() {
    client.login(TOKEN).catch(() => setTimeout(login, 5000))
}
login()
