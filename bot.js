import Discord from "discord.js"
export const client = new Discord.Client()
import fs from "fs"

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

export let logDateOptions = Object.assign(dateOptions, timeOptions)
export let visibleServers = []
export let requestsCounter = 0
export let messagesCounter = 0

let userDB = {}
const floodRate = 5 * 1000; 
const floodMax = 20 * 1000; 
const floodChillsMax = 2;

let layoutCyr = "йцукенгшщзфывапролдячсмить"
let layoutLat = "qwertyuiopasdfghjklzxcvbnm"

function processMessage(msg) {
	
	// рассылка кино-уведомлений
	if (msg.channel.id == '540156381479567371') {
		let pingedUsers = new Set([])
		let data = JSON.parse(fs.readFileSync('cinemadata.json'))
		let embed = {
			description: msg.cleanContent,
			footer: {
				text: msg.author.tag,
				icon_url: msg.author.avatarURL
			}
		}
		if (msg.attachments.size) {
			let att = msg.attachments.first()
			if (att.width) { // test if att is an image
				embed.image = {
					url: att.url
				}
			}
		}
		msg.mentions.roles.forEach(role => {
			if (data[role.id]) {
				embed.color = data[role.id].color
				for (const item of data[role.id].users) {
					if (!pingedUsers.has(item)) {
						pingedUsers.add(item)
						client.fetchUser(item).then(user => {
							user.send({embed: embed});
						})
					}
				}
			}
		})
	}

	// разбиение сообщения на компоненты
	let componentsOrigCase = msg.content.split(/\s+/)
	let componentsOrigPings = msg.cleanContent.split(/\s+/)
	let components = s.getSimpleString(msg.content).split(/\s+/)
	let isPrefixThere = components[0].match(BOT_PREFIX)

	// проверка сообщения на наличие команды
	if (!isPrefixThere && msg.channel.type == "text") {
		return
	}

	// отлично, юзер обращается именно к боту, идём дальше...

	// антифлуд
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
			console.log(`| ${(new Date).toLocaleString("en-US", logDateOptions)} | ${msg.author.tag} is flooding now!!`)
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

	// если юзер не флудит, можем идти дальше...

	// выявление команды и аргументов из сообщения
	if (isPrefixThere) {
		componentsOrigCase.shift()
		componentsOrigPings.shift()
		components.shift()
	}

	let msgSimplifiedOrigCase = componentsOrigCase.join(" ")
	let msgSimplifiedOrigPings = componentsOrigPings.join(" ")
	let msgSimplified = components.join(" ")
	let args = msgSimplified.split(/\s+/)
	let cmd = args.shift()

	if (!components.length) {
		return
	}

	// если команда найдена, запишем сообщение в лог
	requestsCounter++
	s.sentLog(msg, msgSimplifiedOrigPings, logDateOptions)

	// попробовать сменить раскладку на всякий случай
	let cmdLatSwitched = ''
	if (cmd && cmd[0].match(/[а-я]/i)) {
		let iscmdvalid = true
		for (let i = 0; i < cmd.length; i++) {
			if (!cmd[i].match(/[a-z]/i)) {
				cmdLatSwitched += layoutLat[layoutCyr.indexOf(cmd[i])]
			} else {
				iscmdvalid = false
				cmdLatSwitched = ''
				break;
			}
		}
	}

	// ищем команду в регулярках
	for (let i in commands) {
		if (cmd.match(commands[i].r) || cmdLatSwitched.match(commands[i].r)) {
			if (commands[i].v && !s.isThisBotsChannel(msg)) {
				msg.react("#⃣")
					.then(() => {
						msg.react("🤖")
					})
					.catch(error => console.log(error))
			} else {
				commands[i].f(msg, args, msgSimplifiedOrigCase)
			}
			return
		}
	}

	// если это не команда, проверяем на отправку пикчи в Галерею
	if (components[0].match(/^http.+\.(png|jpe?g|bmp|gif|webp)/)) {
		let url = componentsOrigCase[0]
		componentsOrigCase.shift()
		commands.Send.f(msg, null, `send ${url} ${componentsOrigCase.join(" ")}`)
		return
	} else {
		let isSentImageHere = false
		if (msg.channel.type == "dm") {
			msg.attachments.forEach(att => {
				commands.Send.f(msg, null, `send ${att.url} ${msg.content.replace(/\s+/g, " ")}`)
				isSentImageHere = true
			})
		}
		if (isSentImageHere) {
			requestsCounter++
			s.sentLog(msg, msgSimplifiedOrigPings, logDateOptions)
			return
		}
	}

	// "общение"
	for (let i of simpleAnswers) {
		if (msgSimplified.match(i.r)) {
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

	let readyTimeString = new Date(client.readyTimestamp).toLocaleString("en-US", Object.assign(dateOptions, timeOptions))
	console.log(`${client.user.tag} entered Discord \non ${readyTimeString}\n`)

	client.user.setPresence({game: {name: `パドルパドル！！`, type: 0}})
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
	if (um && um % 1000 == 0) console.log(`| ${(new Date).toLocaleString("en-US", logDateOptions)} | Useless messages: ${um}`)
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
	
		if (["⬅", "➡", "🔃"].includes(msgReaction) && msg.author.id == BOT_ID && user.id != BOT_ID) {
			let msg = messageReaction.message
			let cMatch, eMatch, page_number, page_to_go
			if (cMatch = msg.content.match(/hs(2)?#(\d+)/)) {
				page_number = cMatch[1] ? Number(cMatch[2]) + 8130 : Number(cMatch[2])
			} else if (msg.embeds[0] && (eMatch = msg.embeds[0].author.name.match(/hs(2)?#(\d+)/))) {
				page_number = eMatch[1] ? Number(eMatch[2]) + 8130 : Number(eMatch[2])
			}
	
			if (page_number) {
				if (msgReaction == "➡") {
					page_to_go = page_number + 1
				} else if (msgReaction == "⬅") {
					page_to_go = page_number - 1
				} else if (msgReaction == "🔃") {
					page_to_go = page_number
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
	console.log(`| ${(new Date).toLocaleString("en-US", logDateOptions)} | Bot was added to ${guild.name} (${guild.id})`)
})
client.on('guildDelete', (guild) => {
	let index = visibleServers.indexOf(guild.id)
	if (index) {
		visibleServers.splice(index, 1)
	}
	console.log(`| ${(new Date).toLocaleString("en-US", logDateOptions)} | Bot was kicked from ${guild.name} (${guild.id})`)
})
client.on('guildMemberAdd', member => {
	if (member.guild.id == "540145900526501899") {
		let welcomeLines = [
			`Какой-то ПЕК-НЕК ${member} зашёл к нам на чай! <:peckneck:652869904856514574>`,
			`Добро пожаловать в наш филиал #творчества, ${member}! <a:aKanayaThinking:652870040923799585>`,
			`${member}, какова цель вашего визита? Покажите визу <:tanyaVisa:652869921532936203>`,
			`Рады видеть вас в нашем заведении, ${member}! <:dorothy:652869953002668072>`,
			`Добро пожаловать в фан-клуб Тарковского, ${member}! <:tarkovsky:652869970119884810>`,
			`${member}, ｗ ｅ ｌ ｃ ｏ ｍ ｅ <a:peaceAndTranquility:652870064864886794>`
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
