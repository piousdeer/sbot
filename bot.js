// подключаем модули
require('http').createServer().listen(3000);
const Discord = require("discord.js");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const Cheerio = require('cheerio');
const client = new Discord.Client();
const TOKEN = process.env.BOT_TOKEN;

// вспомогательные данные
const readyTime = Date.now();
const dateOptions = {
	weekday: "long",
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
	timeZone: "Europe/Moscow"
};
const translatedTags = {
	"screenshot" : "скрин(шот)?",
	"photoshop" : "фотошоп|фш",
	"art" : "арт|рисунок",
	"gif" : "гиф(ка)?",
	"web" : "веб|интернет[ы]?",
	"minecraft" : "майн(крафт)?",
	"rncr" : "рнкр",
	"randomcraft" : "рандомкрафт",
	"chaoscraft" : "хаоскрафт",
	"likobsk" : "лайкобск",
	"castit" : "кастит",
	"zombiesland" : "зомби[сз]?ленд|зл",
	"hub" : "хаб",
	"whitelist" : "вайтлист",
	"creative" : "креатив",
	"parkour" : "паркур",
	"skyblock" : "скайблок",
	"castlewars" : "кастлв[ао]рс",
	"skywars" : "скайв[ао]рс",
	"build" : "билд(-?сервер)?",
	"getup" : "г[еэи]т[ау]п",
	"haivon" : "хайвон",
	"playerchar" : "пл[аое]й?ер(_?чар)?|чар",
	"dragon" : "др[аэ][кг]он|арч(енгиус)?|(антик(ь?ю|у)и)?авиум",
	"rult" : "р[ау]л[еь]?т",
	"laimon" : "лаймон",
	"imody" : "имоди",
	"kamka" : "камка",
	"namiya" : "намия",
	"subsub" : "с[ау]б(с[ау]б)?",
	"columb" : "[зск][ао]лум[бп]",
	"vasya" : "вася(ок)?",
	"paper" : "п(а|эй|ей)пер|бума(г|жк)а",
	"bug" : "баг",
	"dank" : "д[аэ]нк",
	"map" : "карта",
	"sign" : "табличка",
	"creeper" : "крип(ер|ак)",
	"cake" : "торт(ик)?",
	"irondoor" : "железнаядверь|жд"
};
const ownerID = "172075054912372737";
let botID;
let timeoutForAutoReact;
let whoNeedsToReactToSomething = {};
let whichGuildThisUserMeans = {};

// вспомогательные функции
function escapeRegExp(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getRandomElem(arr) {
	return arr[Math.floor(arr.length*Math.random())];
}
function getSimpleString(str) {
	return str.replace(/\n/g, " ").replace(/ +/g, " ").toLowerCase().replace(/ё/g, "е").replace(/ /g, "_");
}
function pluralize(n, arr) {
	// by PLAYER_CHAR
	let k = n % 10;
	return arr[(n - k) / 10 % 10 != 1 ? (k != 1 ? ([2, 3, 4].includes(k) ? 1 : 2) : 0) : 2];
}
function envelope(msg) {
	// функция для реакции конвертом
	if (msg.channel.type == "text") {
		msg.react("✉");
	}
}
function getStorage(emojiName, guildName, channel) {
	if (guildName) {
		if (guildName.match(/^\d+$/g)) {
			if (client.guilds.get(guildName)) {
				return client.guilds.get(guildName);
			}
		}
		var guildId;
		var guildIdFull;
		client.guilds.forEach(key => {
			if (guildName == getSimpleString(key.name)) {
				guildIdFull = key.id;
			} else if (getSimpleString(key.name).match(new RegExp("^(" + escapeRegExp(guildName) + ")"))) {
				var currentGuildId = key.id;
				client.guilds.get(key.id).emojis.forEach(key => {
					if (key.name.toLowerCase().match(new RegExp("^(" + escapeRegExp(emojiName) + ")"))) {
						guildId = currentGuildId;
					}
				});
			}
		});
		if (!(guildId || guildIdFull)) {
			return client;
		}
		return (guildIdFull) ? client.guilds.get(guildIdFull) : client.guilds.get(guildId);
	} else {
		return client;
	}
}
function findEmoji(emojiName, guildName, channel) {
	var emoji;
	var emojiFull;

	if (emojiName.match(/^\d+$/g)) {
		if (client.emojis.get(emojiName)) {
			emoji = client.emojis.get(emojiName);
			return emoji;
		}
	}

	var storage = getStorage(emojiName, guildName, channel);

	if (!storage) {
		return;
	}

	storage.emojis.forEach(key => {
		if (emojiName == key.name.toLowerCase()) {
			emojiFull = key;
		} else if (key.name.toLowerCase().match(new RegExp("^(" + escapeRegExp(emojiName) + ")"))) {
			emoji = key;
		}
	});

	return (emojiFull) ? emojiFull : emoji;
}
function getEmojiName(emojiText) {
	var emojiRaw;
	if (emojiRaw = emojiText.match(/(?:<:[^:]+:(\d+)>)/)) {
		return emojiRaw[1];
	} else {
		return emojiText;
	}
}
function findUserToGetAvatar(username) {
	// проверка на айди
	if (username.match(/^\d+$/g)) {
		if (client.users.get(username)) {
			return client.users.get(username);
		}
	}

	// проверка на призывалку
	var usernameId = username.match(/<@\!?(\d+)>/);
	if (usernameId) {
		if (client.users.get(usernameId[1])) {
			return client.users.get(usernameId[1]);
		}
	}

	var guildsCounter = 0;
	var isDisplayNameSuitable = false;
	var isDisplayNameCanBeSuitable = false;
	var result;

	client.guilds.forEach(guild => {
		var usersCounter = 0;
		guild.members.forEach(member => {
			if (member.user.avatar) {
				if (username == getSimpleString(member.displayName)) {
					result = member.user;
					isDisplayNameSuitable = true;
				} else if (getSimpleString(member.displayName).match(new RegExp("^(" + escapeRegExp(username) + ")"))) {
					if (!isDisplayNameSuitable) {
						result = member.user;
						isDisplayNameCanBeSuitable = true;
					}
				} else if (member.nickname) {
					if (username == getSimpleString(member.user.username)) {
						if (!isDisplayNameSuitable && !isDisplayNameCanBeSuitable) {
							result = member.user;
						}
					} else if (getSimpleString(member.user.username).match(new RegExp("^(" + escapeRegExp(username) + ")"))) {
						if (!result && !isDisplayNameSuitable && !isDisplayNameCanBeSuitable) {
							result = member.user;
						}
					}
				}
			}
		});
	});
	return result;
}
function autoreact(msg, args, isCommandCanBeAnEmoji) {
	if (!args[0]) {
		msg.react("📜");
		return;
	};

	var emojiName;
	var guildName;
	var messageId = args[1];

	var guildCheck;

	emojiName = getEmojiName(args[0]);

	var emojiError = ["👋", "😶", "🤔", "351002389991653378", "358952906248028160", "357960229259837440", "520641845634531328"];

	if (guildCheck = emojiName.match(/^([^:]+)(?::(\S+))$/)) {
		emojiName = guildCheck[1];
		guildName = guildCheck[2];
	}

	if (messageId) {
		var emoji = findEmoji(emojiName, guildName, msg.channel);

		if (!emoji) {
			if (isCommandCanBeAnEmoji) {
				msg.react(getRandomElem(emojiError));
			} else {
				msg.react("343057042862243840");
			}
			return;
		};

		var wrongChannels = 0;

		client.channels.forEach(key => {
			if (key.type == "text") {
				key.fetchMessage(messageId)
					.then(messageToReact => {
						messageToReact.react(emoji);
						msg.react("⏳");
						var removeReactionTimeout = setTimeout(() => messageToReact.reactions.get(emoji.name + ":" + emoji.id).remove(client.user), 25000);
						messageToReact.awaitReactions((reaction, user) => {
							if (user.id == msg.author.id && reaction.emoji.id == emoji.id) {
								messageToReact.reactions.get(emoji.name + ":" + emoji.id).remove(client.user);
								clearTimeout(removeReactionTimeout);
							}
						}, { time: 25000 });
					})
					.catch(() => {
						if (++wrongChannels == client.channels.size) {
							msg.react("🤷");
						}
					});
			} else {
				wrongChannels++;
			}
		});
	} else {
		if (!findEmoji(emojiName, guildName, msg.channel)) {
			if (isCommandCanBeAnEmoji) {
				msg.react(getRandomElem(emojiError));
			} else {
				msg.react("343057042862243840");
			}
			return;
		}

		msg.react("👌");

		whoNeedsToReactToSomething[msg.author.id] = emojiName;
		whichGuildThisUserMeans[msg.author.id] = guildName;
	}
	deleteUserMessage(msg);
}
function deleteUserMessage(msg) {
	if (msg.channel.type == "text") { // если бот не начал "беседовать" с юзером
		var bot_permissions = msg.channel.permissionsFor(client.user);
		if (bot_permissions.has("MANAGE_MESSAGES")) {
			msg.delete(10000)
				.then(() => {})
				.catch(error => console.log(error));
		}
	}
}
function sendEmojiLinkEmbed(msg, emoji) {
	if (emoji.animated) {
		msg.channel.send({embed: {title: "Emoji", description: ("<a:" + emoji.name + ":" + emoji.id + "> – " + emoji.name), image: {url: ("https://cdn.discordapp.com/emojis/" + emoji.id + ".gif")}}});
	} else {
		msg.channel.send({embed: {title: "Emoji", description: ("<:" + emoji.name + ":" + emoji.id + "> – " + emoji.name), image: {url: ("https://cdn.discordapp.com/emojis/" + emoji.id + ".png")}}});
	}
}
function sendUserAvatarEmbed(msg, user) {
	var avaTemp = user.avatarURL;
	// console.log(avaTemp);
	var avaTempRE = avaTemp.match(/^((?:.*)\.(\w+))/);

	var isAvaGif = (avaTempRE[2] == "gif") ? true : false;
	var avatarURLFixed = isAvaGif ? avaTemp + "?size=2048" : avaTemp;

	msg.channel.send({embed: {title: "Avatar", description: user.tag, image: {url: avatarURLFixed}}});
	// msg.channel.send({embed: {title: "Avatar", description: user.tag, image: {url: avaTemp}}});

	// if (isAvaGif) {
	// 	msg.channel.send("В полном размере:\n<" + avaTemp + ">");
	// }
}
function isThisBotsChannel(msg) {
	if (msg.channel.type == "text" && msg.channel.guild.id == "110107304413638656" && msg.channel.id != "334369998866874369") {
		return false;
	} else {
		return true;
	}
}
function showHomestuckPage(msg, comic_embed, usedArrowButton, contentText) {
	let embed = {embed: comic_embed};
	if (usedArrowButton) {
		if (contentText) {
			msg.edit(contentText, embed);
		} else {
			msg.edit(embed);
		}
	} else {
		contentToSend = (contentText) ? contentText : embed;
		msg.channel.send(contentToSend)
			.then((msg) => {
				msg.react("⬅")
					.then(() => {
						msg.react("➡");
					})
					.catch(error => console.log(error));
			})
			.catch(error => console.log(error));
	}
}
function checkHomestuckReaction(messageReaction, user) {
	let msg = messageReaction.message;
	let msgReaction = messageReaction.emoji.name;

	if (["⬅", "➡"].includes(msgReaction) && msg.author.id == botID && user.id != botID) {
		let msg = messageReaction.message;
		let cMatch, eMatch, page_number;
		if (cMatch = msg.content.match(/hs#(\d+)/)) {
			page_number = Number(cMatch[1]);
		} else if (msg.embeds[0] && (eMatch = msg.embeds[0].author.name.match(/hs#(\d+)/))) {
			page_number = Number(eMatch[1]);
		}

		if (page_number) {
			if (msgReaction == "➡") {
				cmdHomestuck(msg, [page_number + 1], null, true);
			} else if (msgReaction == "⬅") {
				cmdHomestuck(msg, [page_number - 1], null, true);
			}
		}

	}
}
function setCinemaRole(user, doesUserNeedRole) {
	client.guilds.get("110107304413638656").fetchMember(user.id)
		.then((member) => {
			if (doesUserNeedRole) {
				console.log(member.user.tag + " asked to add them Cinema role.");
				member.addRole("542396782878130206")
					.then(() => {})
					.catch(error => console.log(error));
			} else {
				console.log(member.user.tag + " asked to remove them Cinema role.");
				member.removeRole("542396782878130206")
					.then(() => {})
					.catch(error => console.log(error));
			}
		})
		.catch(error => console.log(error));
}
function sfTime(s) {
    return new Date(1420070400000 + s / 4194304);
}
function dateStr(d) {
    if (!d.toJSON) {
        d = new Date(d);
    }
    d.setHours(d.getHours() + 3);
    return d.toJSON().split(".")[0].replace(/T/, ' ') + ' МСК';
}

// функции-команды
function cmdHelp(msg) {
	msg.author.send("Привет, меня зовут СтиллБот.\nЧтобы спросить что-либо, обратись ко мне по имени и введи команду.\nНапример: `сбот пикча креатив намия`\nВ лс можно без обращения: `пикча креатив намия`\n*Используй параметры без скобок `<>[]` (обязательные/необязательные параметры).*\n\n`р <название_эмоджи>`\n\t – поставить реакцию на сообщение. Список доступных реакций: `эмоджи`.\n1. Запроси нужный эмоджи. Обычно это делается в лс одним его названием без команды `p`.\nНапример: `pearlWink`\n2. Поставь любую реакцию на нужное сообщение.\n3. Готово, я поставил эмоджи, тебе осталось лишь тыкнуть на него самому.\nВ случае путаницы можно указать сервер.\nНапример: `pearlWink:still_testing` *(пробелы заменяются на `_`)*\n\n`инвайт`\n\t– пустить меня на свой сервер.\n`пикча [теги через пробел]`\n\t– рандомная картинка из Галереи.\n`отправь <ссылка_на_картинку> <краткое описание>`\n\t– предложить картинку в Галерею.\n\tНапример: `отправь https://i.imgur.com/NnFA0Pz.png Храм Духа Железной Двери, 2014-07-14, синглплеер`\n\t*Также отправка теперь доступна через прикреплённые изображения мне в ЛС, к ним команда не нужна, достаточно лишь данных картинки.*\n`ава <никнейм_юзера>`\n\t– аватарка юзера.\n`хс [номер_страницы]`\n\t– почитать Хоумстак.");
	envelope(msg);
}
function cmdPing(msg) {
	let pongText = "🏓 Понг!";
	msg.channel.send(pongText)
		.then((pong) => {
			userTime = msg.createdTimestamp / 1000;
			botTime = pong.createdTimestamp / 1000;
			pongTime = (botTime - userTime).toFixed(3);
			pong.edit(pongText + " " + pongTime + " сек.");
		})
		.catch(error => console.log(error));
}
function cmdImg(msg, args) {
	// do not spam by pictures
	if (!isThisBotsChannel(msg) && msg.channel.id != "519609441109147655") {
		msg.react("🤖");
		return;
	}

	var typeOfImage = ".png";

	for (var i = 0; i < args.length; i++) {
		for (var key in translatedTags) {
			if (args[i] == "gif") typeOfImage = ".gif";

			if (args[i].match(/^[!]/)) {
				args[i] = "-" + args[i].substr(1);
			}

			if (args[i].match(new RegExp("^(" + translatedTags[key] + ")[.!,]?$"))) {
				args[i] = key;
				break;
			} else if (args[i].match(new RegExp("^[-](" + translatedTags[key] + ")[.!,]?$"))) {
				args[i] = "-" + key;
				break;
			}
		}
	}

	var argsText = "";

	if (args.length > 0) {
		argsText = args.join(",");
		argsText = "?tags=" + encodeURIComponent(argsText);
	}

	var xhrImg = new XMLHttpRequest();
	xhrImg.open('GET', 'https://chaoscraft.ml/files/gallery/random/' + argsText);
	xhrImg.onreadystatechange = function () {
		if (this.readyState == 4 && this.status == 200) {
			var imageInfo = JSON.parse(this.responseText);
			if (!imageInfo.error) {
				msg.channel.send({
					embed: {
						color: 0x7486C2,
						author: {
							name: imageInfo.title,
							icon_url: "https://i.imgur.com/5EOhj0z.png",
							url: ("https://stilltest.tk/gallery/#" + imageInfo.id)
						},
						description: ("Теги: " + imageInfo.tags.join(", ") + (imageInfo.date ? "\nДата: " + imageInfo.date : "")),
						image : {
							url : ("https://i.imgur.com/" + imageInfo.id + typeOfImage)
						}
					}
				});
			} else {
				msg.react("343057042862243840");
			}
		}
	}
	xhrImg.send(null);
}
function cmdTags(msg, args) {
	if (args[0]) {
		return;
	}

	var tags = "Доступные теги:\n\n";
	for (var key in translatedTags) {
		tags += ("`" + key + "` ");
	}
	msg.author.send(tags);
	envelope(msg);
}
function cmdSend(msg, args, msgCommandOriginal) {
	var imageParamsArray = msgCommandOriginal.match(/\S+ (\S+) (.+)/);

	if (!imageParamsArray) {
		msg.react("📜");
		msg.channel.send("Чтобы отправить картинку, нужно добавить к ней описание, дату и место.");
		return;
	}

	var imageLink = imageParamsArray[1];
	var imageTitle = imageParamsArray[2];

	client.channels.get("526441608250392577").send("От " + msg.author.tag + ":\n" + imageTitle + "\n" + imageLink);
	msg.react("📮");
}
function cmdReact(msg, args) {
	autoreact(msg, args, false); // функция вынесена, так как к ней нужен доступ и без команды
}
function cmdEmojiList(msg, args) {
	if (args[0]) {
		return;
	}

	msg.author.send("Доступные эмоджи:");
	var sendingTimer = 800;
	client.guilds.forEach(key => {
		if (key.emojis.size) {
			var emojis = "";
			emojis += (key.name + " (`" + key.id + "`):\n");
			emojiList = [];
			key.emojis.forEach(key => {
					if (key.animated) {
				emojiList.push("<a:" + key.name + ":" + key.id + ">`" + key.name + "`");
					} else {
				emojiList.push("<:" + key.name + ":" + key.id + ">`" + key.name + "`");
					}
			});
			emojis += emojiList.join(", ");
			setTimeout(() => {msg.author.send(emojis, {split: {char: " ", append: "⬛⬛⬛\n"}});}, sendingTimer);
			sendingTimer += 800;
		}
	});
	envelope(msg);
	return;
}
function cmdSticker(msg, args) {
	// do not spam by pictures
	if (!isThisBotsChannel(msg)) {
		msg.react("🤖");
		return;
	}

	if (!args[0]) {
		msg.react("📜");
		return;
	}

	var emoji;

	if (args[0].match(/^\d+$/g)) {
		if (client.emojis.get(args[0])) {
			emoji = client.emojis.get(args[0]);
			sendEmojiLinkEmbed(msg, emoji);
			deleteUserMessage(msg);
			return;
		}
	}

	var emojiName = getEmojiName(args[0]);

	var guildName;
	var guildCheck;

	if (guildCheck = emojiName.match(/^([^:]+)(?::(\S+))$/)) {
		emojiName = guildCheck[1];
		guildName = guildCheck[2];
	}

	emoji = findEmoji(emojiName, guildName, msg.channel);

	if (!emoji) {
		msg.react("343057042862243840");
		return;
	}

	sendEmojiLinkEmbed(msg, emoji);
}
function cmdServers(msg) {
	if (msg.author.id != ownerID) {
		return;
	}
	var servers = "Где меня можно найти:\n";
	client.guilds.forEach(key => {
		servers += ("\n" + key.name + " (`" + key.id + "`)");
	});
	msg.author.send(servers, {split: {char: "\n"}});
	envelope(msg);
}
function cmdAvatar(msg, args, msgCommandOriginal) {
	// do not spam by pictures
	if (!isThisBotsChannel(msg)) {
		msg.react("🤖");
		return;
	}
	var user;
	if (args[0]) {
		user = findUserToGetAvatar(getSimpleString(msgCommandOriginal.match(/\S+ (.+)/)[1]));
		if (user) {
			if (user.avatar) {
				sendUserAvatarEmbed(msg, user);
			}
		} else {
			msg.react("343057042862243840");
		}
	} else {
		user = msg.author;
		sendUserAvatarEmbed(msg, user);
	}
}
function cmdInvite(msg) {
	msg.author.send("Ты можешь пустить меня на свой сервер с помощью этой ссылки: \nhttps://discordapp.com/api/oauth2/authorize?client_id=" + botID + "&scope=bot&permissions=0");
	envelope(msg);
}
function cmdUptime(msg) {

	let diff = Date.now() - readyTime;
	let tarr = [1000, 60, 60, 24];
	for (let i in tarr) {
		let x = tarr[i];
		tarr[i] = diff % x;
		diff = (diff - tarr[i]) / x;
	}
	tarr.push(diff);
	tarr.shift();
	let warr = [
		['секунду', 'секунды', 'секунд'],
		['минуту', 'минуты', 'минут'],
		['час', 'часа', 'часов'],
		['день', 'дня', 'дней'],
	];
	let sarr = [];
	for (let i = tarr.length - 1; i >= 0; i--) {
		if (!tarr[i]) {
			continue;
		}
		sarr.push(tarr[i] + ' ' + pluralize(tarr[i], warr[i]));
	}

	msg.channel.send("Я работаю уже " + sarr.join(', ') + '.');
}
function cmdHomestuck(msg, args, msgCommandOriginal, usedArrowButton) {
	if (!isThisBotsChannel(msg)) {
		msg.react("🤖");
		return;
	}

	let page_number;

	if (args[0]) {
		if (Number(args[0]) >= 1 && Number(args[0]) <= 8130) {
			page_number = args[0];
		} else {
			return;
		}
	} else {
		page_number = 1;
	}

	let page_link = 'https://www.homestuck.com/story/' + page_number;
  let comic_title_empty = "hs#" + page_number;
  let got_error_already = false;
	let embed_color = 0x249E28;

	let comic_embed = {
		color: embed_color,
		author: {
			url: page_link,
			name: comic_title_empty
		}
	}

  let xhrHS = new XMLHttpRequest();
  xhrHS.open('GET', page_link);
  xhrHS.setRequestHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:62.0) Gecko/20100101 Firefox/62.0");

  xhrHS.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      let $ = Cheerio.load(this.responseText);

      let content_container = $('div#content_container');
      let flash_div = $('div#o_flash-container');


      // detecting video
      let is_there_video = false;
      let yt_link = "";
      let yt_link_code;

      if (flash_div.length) {
        let yt_raw = flash_div.html().match(/\'youtubeid\', \'(.+)\'/);
        if (yt_raw) {
          yt_link_code = yt_raw[1];
        }
      } else {
        let yt_raw = $('iframe.ar-inner').attr('src');
        if (yt_raw) {
          yt_link_code = yt_raw.match(/embed\/(.+)/)[1];
        }
      }
      if (yt_link_code) {
        yt_link = "https://youtu.be/" + yt_link_code;
        is_there_video = true;
      }


      if (is_there_video) {
        // send title, desc and video link
        showHomestuckPage(msg, {}, usedArrowButton, comic_title_empty + "\n" + yt_link);
      } else {

				// getting title
	      let comic_title = $('h2.type-hs-header').text();
	      if (comic_title && !is_there_video) {
	        comic_title = comic_title + " (hs#" + page_number + ")";
	      } else {
	        comic_title = comic_title_empty;
	      }
				comic_embed.author.name = comic_title;

	      // getting description
	      let desc = $('p.type-rg').text().replace(/\ +/g, " ").replace(/^\s+/, "").replace(/\s+$/, "");
	      let desc_limit = 2047;
	      if (desc.length > desc_limit) {
	        desc = desc.substring(0, desc_limit) + "…";
	      } else if (desc.length == 0) {
	        desc = "";
	      }
				comic_embed.description = desc;

        // getting images
        let imgs;
        let img_link = "";
        let is_img_from_flash = false;
        if (content_container.length) {
          imgs = content_container.find('img.mar-x-auto.disp-bl');
          if (!imgs.length) {
            let imgs_raw = $('div.bg-scratch-mid-green.pad-t-lg').find('img');
            if (imgs_raw.length) {
              imgs = imgs_raw.attr('src');
              is_img_from_flash = true;
            }
          }
        } else {
          imgs = $('img.mar-x-auto.disp-bl');
        }
        if (flash_div.length && !imgs.length) {
          let imgs_raw = flash_div.html().match(/\'altimgsrc\', \'(.+)\'/);
          if (imgs_raw) {
            imgs = imgs_raw[1];
            is_img_from_flash = true;
          }
        }
        if (imgs.length) {
          // send title, image and desc
          if (is_img_from_flash) {
            img_link = "https://www.homestuck.com" + imgs;
					} else if (imgs.attr('src').startsWith("/")) {
						img_link = "https://www.homestuck.com" + imgs.attr('src');
          } else {
            img_link = imgs.attr('src');
          }

					comic_embed.image = {url: img_link};
        } else {
          // send title and footer
					comic_embed.footer = {text: "It's probably interactive."};
        }
				showHomestuckPage(msg, comic_embed, usedArrowButton, "");
      }
    } else if (this.status == 404 && !got_error_already) {
      // send title and footer
      got_error_already = true;
			comic_embed.footer = {text: "It's probably missing page."};
			showHomestuckPage(msg, comic_embed, usedArrowButton, "");
    }
  }
  xhrHS.send(null);
}
function cmdCinemaPing(msg) {
	if (![ownerID, "184388744558673920", "378318866524143627", "178833086530846720"].includes(msg.author.id)) {
		return;
	}

	let cinemaPing = "";
	client.channels.get("541594001992581122").fetchMessage("542389154424553549")
		.then((message) => {
			message.reactions.get("📽").fetchUsers()
				.then((users) => {
					users.forEach(user => {
						cinemaPing += "<@" + user.id + ">\n";
					});
					cinemaPing += "Приглашаем вас на сегодняшний сеанс!";
					msg.channel.send(cinemaPing);
				})
				.catch(error => console.log(error));
		})
		.catch(error => console.log(error));
}
function cmdSFTime(msg, args) {
	let totalSFTimes = "";
	args.forEach(arg => {
		if (arg.match(/\d{17,20}/)) {
			let totalMatches = arg.match(/\d{17,20}/g);
			for (let i in totalMatches) {
				totalSFTimes += dateStr(sfTime(Number(totalMatches[i]))) + "\n";
			}
		}
	});
	if (totalSFTimes) {
		msg.channel.send(totalSFTimes);
	}
}

// регулярки для команд
const commands = [
	{
		r: /^(х[еэ]лп|помо(щь|ги)|команды|help|comm?ands?)[.!]?$/,
		f: cmdHelp
	},
	{
		r: /^(пинг|ping)[.!]?$/,
		f: cmdPing
	},
	{
		r: /^(пикча|имг|картинк?а|изображение|галерея|img|image|pic(ture)?|gallery)[.!,:]?$/,
		f: cmdImg
	},
	{
		r: /^(т[еэ]ги|tags)[.!]?$/,
		f: cmdTags
	},
	{
		r: /^(отправ(ит)?ь|предложи(ть)?|пришли|прислать|send)$/,
		f: cmdSend
	},
	{
		r: /^([пpрr]|поставь|отреагируй|реакция|react(ion)?)$/,
		f: cmdReact
	},
	{
		r: /^(эмо(д[жз]|ж)и|смайл(ики|ы)|emoji(s|list)?)[.!]?$/,
		f: cmdEmojiList
	},
	{
		r: /^(стикер|sticker|э(мо(д[жз]|ж)и)?линк|e(moji)?link)$/,
		f: cmdSticker
	},
	{
		r: /^(сервер[аы]|servers)[.!]?$/,
		f: cmdServers
	},
	{
		r: /^(ав(атар(ка)?|к?а)|ava(tar)?|pfp)[.!]?$/,
		f: cmdAvatar
	},
	{
		r: /^(приглашение|инвайт|invite)[.!]?$/,
		f: cmdInvite
	},
	{
		r: /^(ап(тайм)?|up(time)?)[.!]?$/,
		f: cmdUptime
	},
	{
		r: /^(hs|хс|хоумстак|homestuck)[.!]?$/,
		f: cmdHomestuck
	},
	{
		r: /^(кинопинг|cinemaping)[.!]?$/,
		f: cmdCinemaPing
	},
	{
		r: /^(sftime)[.!]?$/,
		f: cmdSFTime
	}
]
const simpleAnswers = [
	{
		r: /^(прив(ет(ствую)?)?|здравствуй(те)?|х[ао]й|хауди)[.!]?$/,
		t: ["Привет.", "Hello, world!", "Доброго времени суток!"],
		e: null
	},
	{
		r: /^(пока|до свидания|прощай(те)?|до скорого)[.!]?$/,
		t: ["Пока!", "До скорой встречи!", "До свидания!"],
		e: null
	},
	{
		r: /^((доброй|спокойной) ночи|(добрых|спокойных|хороших|сладких) снов)[.!]?/,
		t: null,
		e: "🌃"
	},
	{
		r: /^(как дела|что (ты )?делаешь)[?]?/,
		t: ["Отвечаю на твоё сообщение.", "Какие дела могут быть у скрипта?"],
		e: null
	},
	{
		r: /^((что ты|ты что) такое|(кто ты|ты кто)( такой)?)[?]?/,
		t: ["Я – просто скрипт."],
		e: null
	}
]

// что делать в ответ на сообщение
function answerInRegularMode(msg) {
	// если юзер отправил в лс картинку-аттачмент
	if (msg.channel.type == "dm") {
		let attList = [];
		msg.attachments.forEach(att => {
			attList.push(att.url);
		});

		if (attList.length) {
			if (msg.content) {
				cmdSend(msg, false, "sbot " + attList.join(" ") + " " + msg.content);
			} else {
				msg.react("📜");
				msg.channel.send("Чтобы отправить картинку, нужно добавить к ней описание, дату и место.");
			}
			return;
		}
	}

	// обработка сообщения
	var msgoc = msg.content.replace(/\n/g, " ").replace(/ +/g, " ");
	var msglc = msgoc.toLowerCase().replace(/ё/g, "е");
	var msgCommandOriginal;
	var msgCommand;
	var msglcDivided;

	// проверка сообщения на наличие команды
	if (msglcDivided = msglc.match(new RegExp("^(?:сб|сбот|стилл?бот|sb|sbot|still?bot|<@" + botID + ">)" + ",? (.+)$"))) {
		msgCommandOriginal = msgoc.match(/^\S+ (.+)$/)[1];
		msgCommand = msglcDivided[1];
	} else if (msg.channel.type != "text") {
		msgCommandOriginal = msgoc;
		msgCommand = msglc;
	} else {
		return;
	}

	// only allowed RC channels!
	if (msg.channel.type == "text" && msg.channel.guild.id == "110107304413638656" && !(["519609441109147655","521683316899053596","334369998866874369", "541594001992581122"].includes(msg.channel.id))) {
		 return;
	}

	// если всё ок, продолжаем...
	// отослать текст запроса в логи
	var serverWhereUserIs = "Direct Messages";
	if (msg.channel.type == "text") {
		serverWhereUserIs = (msg.channel.guild.name + " (" + msg.channel.guild.id + ")");
	}
	console.log((new Date).toLocaleString("ru", dateOptions) + "\nFrom " + serverWhereUserIs + ":\n" + msg.author.id + " | " + msg.author.tag + ": " + msg.content);

	// поделить запрос на "основную команду" и аргументы
	var args = msgCommand.split(" ");
	var cmd = args.shift();

	// ищем команду в регулярках
	for (var i of commands) {
		if (cmd.match(i.r)) {
			i.f(msg, args, msgCommandOriginal);
			return;
		}
	}

	// "общение"
	for (var i of simpleAnswers) {
		if (msgCommand.match(i.r)) {
			if (i.e) {
				msg.react(i.e);
			} else if (i.t) {
				msg.channel.send(getRandomElem(i.t));
			}
			return;
		}
	}

	// если запрос не соответствует ни одной из команд, попробовать автореакцию
	args.unshift(cmd);
	autoreact(msg, args, true);
}

// действия непосредственно после запуска бота
client.on('ready', () => {

	var readyTimeString = new Date(readyTime).toLocaleString("ru", dateOptions);
	console.log(client.user.tag + " entered Discord on " + readyTimeString);

	client.user.setPresence({game: {name: "Сбот, команды", type: 0}});
	botID = client.user.id;

	// кэширование сообщений для реакций
	client.guilds.forEach(guild => {
		guild.channels.forEach(channel => {
			if (channel.type == "text") {
				if (channel.permissionsFor(client.user).has("READ_MESSAGES")) {
					channel.fetchMessages({limit: 100})
						.then(() => {})
						.catch(error => console.log(error));
				}
			}
		});
	});

	// кэширование реакций кинотеатра
	client.channels.get("541594001992581122").fetchMessage("542389154424553549")
		.then(() => {})
		.catch(error => console.log(error));

});
client.on('message', msg => {
	if (msg.author.id == botID) return;
	setTimeout(answerInRegularMode, 300, msg);
});
client.on('messageReactionAdd', (messageReaction, user) => {
	let msg = messageReaction.message;
	let msgReaction = messageReaction.emoji.name;

	if (whoNeedsToReactToSomething[user.id]) {
		var currentUser = client.users.get(user.id);
		var currentEmoji = findEmoji(whoNeedsToReactToSomething[user.id], whichGuildThisUserMeans[user.id]);

		messageReaction.message.react(currentEmoji);
		clearTimeout(timeoutForAutoReact);

		delete whoNeedsToReactToSomething[user.id];
		delete whichGuildThisUserMeans[user.id];

		var timerForDeletingAutoReaction = setTimeout(() => {
			messageReaction.message.reactions.get(currentEmoji.name + ":" + currentEmoji.id).remove(client.user);
		}, 25000);

		messageReaction.message.awaitReactions((messageReactionAwaited, user) => {
			if (user.id == currentUser.id && messageReactionAwaited.emoji.id == currentEmoji.id) {
				messageReactionAwaited.message.reactions.get(messageReactionAwaited.emoji.name + ":" + messageReactionAwaited.emoji.id).remove(client.user);
				clearTimeout(timerForDeletingAutoReaction);
			}
		}, { time: 25000 });
	} else if (msgReaction == "❌" && [botID, ownerID].includes(msg.author.id) && user.id == ownerID) {
		msg.delete(300);
	} else if (msgReaction == "📽" && msg.id == "542389154424553549") {
		setCinemaRole(user, true);
	} else {
		checkHomestuckReaction(messageReaction, user);
	}
});
client.on('messageReactionRemove', (messageReaction, user) => {
	let msg = messageReaction.message;
	let msgReaction = messageReaction.emoji.name;

	if (msgReaction == "📽" && msg.id == "542389154424553549") {
		setCinemaRole(user, false);
	} else {
		checkHomestuckReaction(messageReaction, user);
	}

});

// подключение к Дискорду
client.login(TOKEN);
