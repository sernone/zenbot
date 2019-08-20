var Discord = require("discord.js");
var auth = require("./auth.json");
var fs = require("fs")
var client = new Discord.Client();

client.login(auth.token);

try {
    client.on("ready", () => {
      console.log(client.user.username + " - (" + client.user.id + ") Connected");

      initRoleSystem();
    });
} catch (e) {
    console.error(e.message);
}

try {
    client.on("guildCreate", () => {
        initRoleSystem();
    });
}
catch (e) {
    console.error(e.message);
}

try {
  client.on("guildMemberAdd", member => {
    const friendRole = member.guild.roles.find(r => r.name === "Friends");
    if (!member.roles.get(friendRole.id)) {
      member.addRole(friendRole.id, "Added friend role to " + member.displayName);
    }
  })
}
catch (e) {
  console.log(e)
}

try {
    client.on("message", message => {
        var msgChat = message.content;
        if (msgChat.substring(0, 1) == "!") {
          var cmd =
            msgChat.substring(1, msgChat.indexOf(" ")) !== "!"
              ? msgChat.substring(1, msgChat.indexOf(" "))
              : msgChat.substring(1);
          var arg = msgChat.substring(msgChat.indexOf(" ") + 1);
      
          switch (cmd.toLowerCase()) {
            case "addfanrole":
                addFanRole(message, arg);
            break;
          }
        }
    });
}
catch (e) {
    console.error(e);
}

try {
  client.on("presenceUpdate", (oldMember, newMember) => {
    if (newMember.roles.find(r => r.name === 'Stream Team') && newMember.presence.game !== null) {
      var isStreaming = JSON.parse(fs.readFileSync("./streaming.json", "utf8"));
      if (newMember.presence.game.streaming === true) {
        if (!isStreaming[newMember.id]) {
          const streamChannel = newMember.guild.channels.find(c => c.name === "streams");
          streamChannel.send("Check out our Zen Streamer " + newMember.displayName + " at " + newMember.presence.game.url);
          isStreaming[newMember.id] = true;
          fs.writeFileSync("./streamers.json", JSON.stringify(isStreaming));
        }
      } else {
          delete isStreaming[newMember.id]
          fs.writeFileSync("./streamers.json", JSON.stringify(isStreaming))
      }
    }
  })
}
catch (e) {
  console.error(e)
}

try {
    client.on("raw", event => {
        if (event.t === 'MESSAGE_REACTION_ADD' || event.t == "MESSAGE_REACTION_REMOVE"){
          var readFile = JSON.parse(fs.readFileSync("./fan-roles-"  + event.d.guild_id + ".json", "utf8"));
          if (readFile.roleMsg.msgId == event.d.message_id) {
            var roleChan = client.channels.get(event.d.channel_id);
            var getRoles = readFile.roles;
            var roleToFind = getRoles.find(r => r.emote === event.d.emoji.name);
      
            roleChan.fetchMessage(event.d.message_id)
              .then(msg => {
                var usr = msg.guild.members.get(event.d.user_id);
                if(roleToFind !== undefined) {
                  var roleToAdd = msg.guild.roles.find(r => r.name === roleToFind.role_name);
      
                  if (event.t === 'MESSAGE_REACTION_ADD') {
                    usr.addRole(roleToAdd);
                  } else {
                    usr.removeRole(roleToAdd);
                  }
                } else {
                  var emoteToRemove = msg.reactions.find(r => r.emoji.name === event.d.emoji.name);
                  emoteToRemove.remove(usr)
                }
              });
          }
        }
      })
}
catch (e) {
    console.error(e.message);
}

function initRoleSystem() {
    try {
        client.guilds.every(guild => {
            const roleChan = guild.channels.find(chan => chan.name === 'role-call');
            const roleFile = "./fan-roles-" + guild.id + ".json";

            //create file first
            if (!fs.existsSync(roleFile)) {
               fs.writeFileSync(roleFile, '{"roleMsg":{"msg":"Welcome to the ' + guild.name + ' Fan System. Please click on one of the reactions below to be added to that role!","sentMsg":false,"msgId":""},"roles":[]}');
               let roleInfo = JSON.parse(fs.readFileSync(roleFile, "utf8"));
               roleChan.send(roleInfo["roleMsg"].msg)
               .then(function(message) {
                   roleInfo["roleMsg"].sentMsg = true;
                   roleInfo["roleMsg"].msgId = message.id;
   
                   const fanRoles = roleInfo["roles"];
                   for (role in fanRoles) {
                       let foundEmote = guild.emojis.find(e => e.name === fanRoles[role].emote);
                       let foundRole = guild.roles.find(r => r.name === fanRoles[role].role_name);
   
                       if(foundEmote && foundRole) {
                           message.react(foundEmote);
                           fanRoles[role].found = true;
                       }
                   }
   
                   fs.writeFileSync(roleFile, JSON.stringify(roleInfo));
               });
            }
        });
    }
    catch(e) {
        console.error(e);
    }
}

function addFanRole(msg, args) {
    try {
      if (msg.member.roles.find(r => r.name === "Staff - Org")) {
        const fileName = "./fan-roles-" + msg.guild.id + ".json";
        var roleFile = JSON.parse(fs.readFileSync(fileName, "utf8"));
        var roleArea = roleFile.roles;
  
        var curServer = msg.guild;
  
        args = args.match(/\w+|"[^"]*"/g);
        var addingRole = args[1].replace(/^"(.*)"$/, '$1');
  
        var foundEmote = curServer.emojis.find(e => e.name === args[0]);
  
        if (!foundEmote) throw "Error finding custom emoji, make sure it's uploaded first.";
  
        if(!roleArea.find(r => r.role_name === addingRole)) {
            curServer.createRole({
            name: addingRole,
            color: 'RANDOM'
          })
          .then(res => {
            roleFile.roles.push({"emote": args[0], "role_name": addingRole, "found": false});
            fs.writeFileSync("./fan-roles-" + curServer.id + ".json", JSON.stringify(roleFile));
  
            var roleChan = curServer.channels.find(chan => chan.name === "role-call");
            roleChan.fetchMessage(roleFile["roleMsg"].msgId)
            .then(mess => {
              mess.react(foundEmote);
  
              msg.reply("We have added the " + addingRole + " to the server. ");
            })
            .catch(console.error());
          });
        } else {
          msg.reply("This role " + addingRole + " already exists. Please use a different name or contact a server admin.");
        }
      }
    } catch (e) {
      msg.reply("Error adding role, nothing completed. Possible custom emoji doesn't exist. Please consult an admin.");
      console.error(e);
    }
  }
