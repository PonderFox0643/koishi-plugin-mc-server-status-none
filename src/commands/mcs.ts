import { Context } from "koishi";
import { Config } from '../index';
import mc from "@ahdg/minecraftstatuspinger";
import { autoToHTML as motdParser } from '@sfirew/minecraft-motd-parser';
import { } from 'koishi-plugin-puppeteer';
import { motdJsonType } from "@sfirew/minecraft-motd-parser/types/types";
import Umami from "../umami";

interface Status {
  description: motdJsonType;
  players: { max: number; online: number };
  version: { name: string; protocol: number };
  favicon: string;
}

function extractNeonMaon(versionName: string): { neon: string | number, maon: string | number } {
  // 正则表达式匹配指定格式的数字
  const neonMatch = /§r§c§l(\d+)/.exec(versionName);  // 匹配§r§c§l之后的数字
  const maonMatch = /§r§7\/§c§l(\d+)/.exec(versionName);  // 匹配§r§7/§c§l之后的数字

  // 使用三元运算符，根据匹配情况设置返回值
  const neon = neonMatch ? parseInt(neonMatch[1], 10) : "不是狐服";
  const maon = maonMatch ? parseInt(maonMatch[1], 10) : "不是狐服";

  return { neon, maon };
}

function generateHtml(result: string, cicon: boolean, server: string, footer: string, icon64: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=auto, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background-color: #1a202c;
      color: #fff;
    }
  </style>
</head>
<body style="width: 650px">
  <div class="container mx-auto py-8">
    ${cicon ? `<div class="text-center"><img src=${icon64} alt="icon" class="w-70px h-70px mx-auto" /></div>` : ''}
    <div class="text-center mt-4">
      <div class="text-lg font-bold text-white">${result}</div>
    </div>
  </div>
  <footer class="bg-gray-800 text-center py-2">
    <p class="text-sm text-gray-400">${footer}</p>
  </footer>
</body>
</html>`;
}

export async function mcs(ctx: Context, config: Config) {
  ctx.command('mcs [server]', '查询Minecraft服务器状态', { authority: config.authority })
    .action(async ({ session }, server) => {
      if (config.data_collect) {
        Umami.send({
          ctx,
          url: '/mcs',
          urlSearchParams: {
            args: session.argv.args?.join(', '),
            ...(session.argv.options || {}),
          }
        });
      }
      server = server || (await ctx.database.get('mc_server_status', session.guildId))[0]?.server_ip || config.IP;
      let mcPort = 25565;
      if (server.includes(":")) {
        let [host, port] = server.split(":");
        server = host;
        mcPort = parseInt(port);
      }
      let mcdata: any;
      try {
        mc.setDnsServers([config.dnsServer]);
        mcdata = await mc.lookup({
          host: server,
          port: mcPort,
          disableSRV: config.skipSRV,
        });
      } catch (e) {
        return `出现错误: ${e.message}`;
      }

      const status: Status = mcdata.status as any;
      const { neon, maon } = extractNeonMaon(status.version.name);
      let result = `<p>${server} - 延迟 ${mcdata.latency}ms</p>`;
      result += `<p>版本: ${status.version.name} - ${status.version.protocol}</p>`;
      if (config.motd) {
        const motd = motdParser(status.description);
        result += `<p>${motd}</p>`;
      }
      result += `<p>(狐服兼容）在线人数: ${neon}/${maon}</p>`; 
      result += `<p>在线人数: ${status.players.online}/${status.players.max}</p>`;

      const icon = status.favicon;
      const footer = config.footer.replace(/\n/g, '</br>');
      const html = generateHtml(result, config.icon, server, footer, icon);
      const image = await ctx.puppeteer.render(html);
      return image;
    });
}
