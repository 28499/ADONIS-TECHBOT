const totals = {
    received: 0,
    success: 0,
    failed: 0,
    blocked: 0,
    unknown: 0
};

const green = value => `\u001b[92m${value}\u001b[0m`;
const print = value => console.log(green(value));

function getMessageType(message) {
    let content = message?.message;
    if (content?.ephemeralMessage?.message) content = content.ephemeralMessage.message;
    if (!content || Object.keys(content).length === 0) return 'EMPTY';
    return Object.keys(content).join(', ');
}

function logUpsert(update) {
    const messages = update.messages || [];
    print(`[WA EVENT] messages.upsert | TYPE: ${update.type || 'unknown'} | COUNT: ${messages.length}`);

    for (const message of messages) {
        const chat = message.key?.remoteJid || 'unknown';
        const sender = message.key?.participant || chat;
        const fromMe = Boolean(message.key?.fromMe);
        print('');
        print('[WA MESSAGE RECEIVED]');
        print(`  Chat        : ${chat}`);
        print(`  Sender      : ${sender}`);
        print(`  From Me     : ${fromMe}`);
        print(`  Message Type: ${getMessageType(message)}`);
        if (update.type !== 'notify' && chat !== 'status@broadcast') {
            print(`[WA MESSAGE SKIPPED] Event type is ${update.type || 'unknown'}`);
        }
    }
}

function commandStarted(message, command, chatType) {
    totals.received += 1;
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    print('╔══════════════════════════════════════════════════╗');
    print(`║ [${time}] INCOMING COMMAND                      ║`);
    print('╚══════════════════════════════════════════════════╝');
    const senderId = message.key?.participant || message.key?.remoteJid || 'Unknown';
    const senderName = message.pushName && message.pushName !== senderId ? `${message.pushName} (${senderId})` : senderId;
    print(`  Sender    : ${senderName}`);
    print(`  Chat      : ${chatType}`);
    print(`  Command   : ${command}`);
    print('  Status    : PROCESSING');
}

function commandSucceeded(command) {
    totals.success += 1;
    print(`[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] COMMAND PROCESSED`);
    print(`  Command   : ${command}`);
    print('  Status    : SUCCESS');
    logTotals();
}

function commandBlocked(command) {
    totals.blocked += 1;
    print(`[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] COMMAND BLOCKED`);
    print(`  Command   : ${command}`);
    print('  Status    : BLOCKED');
    logTotals();
}

function commandUnknown(command) {
    totals.unknown += 1;
    print(`[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] UNKNOWN COMMAND`);
    print(`  Command   : ${command}`);
    print(`  Parsed as : ${command.slice(1).split(/\s+/)[0]}`);
    print('  Status    : NOT FOUND');
    logTotals();
}

function commandFailed(command) {
    totals.failed += 1;
    print(`[${new Date().toLocaleTimeString('en-GB', { hour12: false })}] COMMAND FAILED`);
    print(`  Command   : ${command}`);
    print('  Status    : FAILED');
    logTotals();
}

function logTotals() {
    print(`  TOTALS    : received=${totals.received} | success=${totals.success} | failed=${totals.failed} | blocked=${totals.blocked} | unknown=${totals.unknown}`);
}

function handlerReturned() {
    print('[HANDLER] Message processing returned successfully');
}

function handlerForwarding() {
    print('[HANDLER] Forwarding message to messageHandler.js');
}

function ready() {
    print('[READY] WhatsApp connected successfully');
}

module.exports = {
    logUpsert,
    commandStarted,
    commandSucceeded,
    commandBlocked,
    commandUnknown,
    commandFailed,
    handlerForwarding,
    handlerReturned,
    ready
};
