const suppressedMessages = {
    info: [
        'Closing session:',
        'Removing old closed session:'
    ],
    warn: [
        'Decrypted message with closed session.'
    ],
    error: [
        'Failed to decrypt message with any known session...',
        'Session error:Error: Bad MAC'
    ]
};

function installQuietSignalLogs(logger = console) {
    for (const [level, prefixes] of Object.entries(suppressedMessages)) {
        const write = logger[level].bind(logger);
        logger[level] = (...args) => {
            const message = args[0];
            if (
                process.env.BOT_DEBUG !== 'true' &&
                typeof message === 'string' &&
                prefixes.some(prefix => message.startsWith(prefix))
            ) {
                return;
            }
            write(...args);
        };
    }
}

module.exports = installQuietSignalLogs;
