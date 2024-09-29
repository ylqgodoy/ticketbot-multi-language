const Discord = require("discord.js")
const config = require("./config.json")
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildEmojisAndStickers,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildWebhooks,
    Discord.GatewayIntentBits.GuildPresences,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.MessageContent,
  ]
});

const { QuickDB } = require('quick.db');
global.db = new QuickDB();

module.exports = client

client.on('interactionCreate', (interaction) => {
  if (interaction.type === Discord.InteractionType.ApplicationCommand) {
    const cmd = client.slashCommands.get(interaction.commandName);
    if (!cmd) return interaction.reply(`Error`);
    interaction["member"] = interaction.guild.members.cache.get(interaction.user.id);
    cmd.run(client, interaction)

  }
})

client.on("ready", async () => {
  const atividade = [{ name: `Trabalhando: Atendendo tickets 💙`, type: 4 }];
  const status = [`online`];

  let random1 = 0;
  setInterval(() => {
    if (random1 >= atividade.length) random1 = 0
    client.user.setActivity(atividade[random1])
    random1++
  }, 10000)

  let random2 = 0;
  setInterval(() => {
    if (random2 >= atividade.length) random2 = 0

    client.user.setStatus(status[random2])
    random2++
  }, 25000)

})

client.on('ready', () => {
  console.log(`⚙ Estou online em ${client.user.username}\n\ndeveloper: github.com/ylqgodoy`)
})

process.on('uncaughtException', (error, origin) => {
  console.log(`🚫 Erro Detectado:]\n\n${error.stack}`);
});

client.slashCommands = new Discord.Collection()

require('./handler')(client)
client.on("interactionCreate", require('./events/ticket').execute);
client.on("interactionCreate", require('./events/assumir_ticket').execute);

client.login(config.token)