import { EGRESS_PROBE_SELF_EXIT_MS } from './browser-route-egress-probe-budgets'

export function browserRouteWebrtcEgressElectronMain(): string {
  return String.raw`
const { app, BrowserWindow, session } = require('electron')
const dgram = require('node:dgram')
const net = require('node:net')
const os = require('node:os')
const { readFileSync, writeFileSync } = require('node:fs')
const config = JSON.parse(readFileSync(process.argv[2], 'utf8'))
// This probe owns no interactive UI or Dock presence.
if (process.platform === 'darwin') app.setActivationPolicy('accessory')

function bind(socket, host) {
  return new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.bind(0, host, () => {
      socket.off('error', reject)
      resolve(socket.address())
    })
  })
}

function listen(server, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, host, () => {
      server.off('error', reject)
      resolve(server.address())
    })
  })
}

// Why: STUN has to target a routable interface; a loopback candidate never leaves the host.
function viewerAddress() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address
    }
  }
  return '127.0.0.1'
}

function iceScript(host, port) {
  return [
    "(async () => {",
    "  const peer = new RTCPeerConnection({",
    "    iceServers: [{ urls: 'stun:" + host + ":" + port + "' }],",
    "    iceCandidatePoolSize: 1",
    "  })",
    "  peer.createDataChannel('probe')",
    "  const offer = await peer.createOffer()",
    "  await peer.setLocalDescription(offer)",
    "  await new Promise((resolve) => setTimeout(resolve, 3000))",
    "  peer.close()",
    "})()"
  ].join('\n')
}

async function probe() {
  const udp = dgram.createSocket('udp4')
  const tcp = net.createServer((socket) => socket.destroy())
  const packets = []
  udp.on('message', (message) => packets.push(message.length))
  const [udpAddress, tcpAddress] = await Promise.all([
    bind(udp, '0.0.0.0'),
    listen(tcp, '127.0.0.1')
  ])
  const partition = 'persist:webrtc-egress-' + config.protectedGuest + '-' + Date.now()
  const routeSession = session.fromPartition(partition, { cache: false })
  await routeSession.setProxy({
    mode: 'fixed_servers',
    proxyRules: 'socks5://127.0.0.1:' + tcpAddress.port,
    proxyBypassRules: '<-loopback>'
  })
  await routeSession.closeAllConnections()
  const resolvedProxy = await routeSession.resolveProxy('https://example.invalid/')
  const window = new BrowserWindow({
    show: false,
    webPreferences: { partition, sandbox: true, nodeIntegration: false, contextIsolation: true }
  })
  if (config.protectedGuest) {
    window.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')
  }
  const policy = window.webContents.getWebRTCIPHandlingPolicy()
  await window.loadURL('data:text/html,<title>WebRTC egress probe</title>')
  await window.webContents.executeJavaScript(iceScript(viewerAddress(), udpAddress.port))
  // Why: attribution is by observed datagram, so let the last candidates land before the socket closes.
  await new Promise((resolve) => setTimeout(resolve, 500))
  window.destroy()
  udp.close()
  tcp.close()
  return { packets: packets.length, policy, resolvedProxy }
}

async function run() {
  const timeout = setTimeout(() => app.exit(2), ${EGRESS_PROBE_SELF_EXIT_MS})
  await app.whenReady()
  const result = await probe()
  writeFileSync(config.resultPath, JSON.stringify(result))
  clearTimeout(timeout)
  app.quit()
}

run().catch((error) => {
  writeFileSync(config.resultPath, JSON.stringify({ error: String(error?.stack || error) }))
  app.exit(1)
})
`
}
