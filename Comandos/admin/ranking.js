const Discord = require("discord.js");
const assumed = require("../../assumed.json");
const config = require("../../config.json");
const userLanguages = require("../../translation/languages-rank.json");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = {
    name: "ranking",
    description: "[ 🏆 ] View the ticket handling ranking!",
    type: Discord.ApplicationCommandType.ChatInput,
    options: [
        {
            name: "language",
            description: "Choose the language for the ranking display.",
            type: Discord.ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: "Português",
                    value: "pt"
                },
                {
                    name: "English",
                    value: "en"
                }
            ]
        }
    ],

    run: async (client, interaction) => {
        const language = interaction.options.getString("language");
        const lang = userLanguages[language];

        const user1 = interaction.guild.members.cache.get(interaction.user.id);
        const roleIdToCheck = config.cargo_staff;

        const hasRequiredRole = roleIdToCheck.some(roleID => user1.roles.cache.has(roleID));

        if (!hasRequiredRole) {
            await interaction.reply({ content: lang.noPermission, ephemeral: true });
            return;
        }

        const rankingArray = Object.entries(assumed).map(([userId, count]) => ({ userId, count }));
        rankingArray.sort((a, b) => b.count - a.count);
        const top5 = rankingArray.slice(0, 5);
        let rankingMessage = "";

        if (top5.length > 0) {
            rankingMessage = top5.map((entry, index) => {
                const member = interaction.guild.members.cache.get(entry.userId);
                const username = member ? member.user.username : lang.userNotFound;
                return lang.rankingEntry
                    .replace("{0}", index + 1)
                    .replace("{1}", username)
                    .replace("{2}", entry.count);
            }).join("\n");
        } else {
            rankingMessage = lang.noRanking;
        }

        interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setTitle(lang.rankingTitle)
                    .setDescription(lang.rankingDescription.replace("{0}", rankingMessage))
                    .setColor("#FFD700")
                    .setFooter({ text: lang.rankingFooter, iconURL: interaction.guild.iconURL({ dynamic: true }) })
                    .setTimestamp()
            ]
        });
    }
};