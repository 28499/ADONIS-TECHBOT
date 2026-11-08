const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const yts = require('yt-search');

const execFileAsync = promisify(execFile);

const TEMP_DIR = path.join(process.cwd(), 'temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function isYouTubeUrl(text) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(
        text.trim()
    );
}

function sanitizeFilename(name) {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 150);
}

async function verifyDependencies() {
    if (process.env.BOT_DEBUG === 'true') console.log('[SONG] Checking system dependencies...');

    try {
        const result = await execFileAsync(
            'ffmpeg',
            ['-version'],
            {
                windowsHide: true,
                maxBuffer: 2 * 1024 * 1024
            }
        );

        const firstLine = result.stdout
            .split(/\r?\n/)
            .filter(Boolean)[0] || 'FFmpeg detected';

        if (process.env.BOT_DEBUG === 'true') console.log('[SONG] ' + firstLine);
    } catch (error) {
        throw new Error(
            'FFmpeg was not found in PATH. Run "ffmpeg -version" in PowerShell.'
        );
    }

    try {
        await execFileAsync(
            'ffprobe',
            ['-version'],
            {
                windowsHide: true,
                maxBuffer: 2 * 1024 * 1024
            }
        );

        if (process.env.BOT_DEBUG === 'true') console.log('[SONG] FFprobe detected');
    } catch (error) {
        throw new Error(
            'FFprobe was not found in PATH. Run "ffprobe -version" in PowerShell.'
        );
    }

    try {
        const result = await execFileAsync(
            'yt-dlp',
            ['--version'],
            {
                windowsHide: true,
                maxBuffer: 2 * 1024 * 1024
            }
        );

        if (process.env.BOT_DEBUG === 'true') console.log(
            '[SONG] yt-dlp detected: ' +
            result.stdout.trim()
        );
    } catch (error) {
        throw new Error(
            'yt-dlp was not found in PATH. Run "yt-dlp --version" in PowerShell.'
        );
    }
}

async function downloadYouTubeAudio(url, outputFile) {
    if (process.env.BOT_DEBUG === 'true') console.log(
        '[SONG] Downloading with yt-dlp: ' + url
    );

    await verifyDependencies();

    await execFileAsync(
        'yt-dlp',
        [
            '--no-playlist',
            '--no-part',
            '--no-mtime',

            '-f',
            'bestaudio/best',

            '--extract-audio',
            '--audio-format',
            'mp3',
            '--audio-quality',
            '192K',

            '-o',
            outputFile,

            url
        ],
        {
            windowsHide: true,
            maxBuffer: 20 * 1024 * 1024
        }
    );

    if (!fs.existsSync(outputFile)) {
        throw new Error(
            'yt-dlp did not create the MP3 file.'
        );
    }

    const stats = fs.statSync(outputFile);

    if (stats.size === 0) {
        throw new Error(
            'Downloaded MP3 file is empty.'
        );
    }

    if (process.env.BOT_DEBUG === 'true') console.log(
        '[SONG] Download complete: ' +
        stats.size +
        ' bytes'
    );

    return outputFile;
}

async function songCommand(sock, chatId, message) {
    let text = '';

    try {
        text =
            (message &&
                message.message &&
                message.message.conversation) ||
            (message &&
                message.message &&
                message.message.extendedTextMessage &&
                message.message.extendedTextMessage.text) ||
            message.text ||
            '';

        text = text.trim();

        const parts = text.split(/\s+/);
        parts.shift();

        const query = parts.join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, {
                text:
                    '🎵 Usage:\n\n' +
                    '.play song name\n' +
                    '.song song name\n\n' +
                    'Example:\n' +
                    '.play blessed oh my soul'
            });

            return;
        }

        if (process.env.BOT_DEBUG === 'true') console.log('[SONG] Query: ' + text);

        let videoUrl;
        let title = 'Song';
        let safeTitle = 'song';

        if (isYouTubeUrl(query)) {
            videoUrl = query;

            if (process.env.BOT_DEBUG === 'true') console.log(
                '[SONG] Direct YouTube URL: ' +
                videoUrl
            );

            try {
                const result = await execFileAsync(
                    'yt-dlp',
                    [
                        '--no-playlist',
                        '--print',
                        '%(title)s',
                        '--skip-download',
                        videoUrl
                    ],
                    {
                        windowsHide: true,
                        maxBuffer: 5 * 1024 * 1024
                    }
                );

                if (result.stdout.trim()) {
                    title = result.stdout
                        .trim()
                        .split(/\r?\n/)[0];
                }
            } catch (titleError) {
                if (process.env.BOT_DEBUG === 'true') console.log(
                    '[SONG] Could not read title, continuing with URL'
                );
            }

            safeTitle =
                sanitizeFilename(title) || 'song';
        } else {
            if (process.env.BOT_DEBUG === 'true') console.log(
                '[SONG] Searching YouTube...'
            );

            const results = await yts(query);

            if (
                !results ||
                !results.videos ||
                results.videos.length === 0
            ) {
                throw new Error(
                    'No YouTube results found.'
                );
            }

            const video = results.videos[0];

            videoUrl = video.url;
            title = video.title || 'Song';

            safeTitle =
                sanitizeFilename(title) || 'song';

            if (process.env.BOT_DEBUG === 'true') console.log(
                '[SONG] Selected: ' + title
            );

            if (process.env.BOT_DEBUG === 'true') console.log(
                '[SONG] URL: ' + videoUrl
            );
        }

        const timestamp = Date.now();

        const mp3File = path.join(
            TEMP_DIR,
            safeTitle + '-' + timestamp + '.mp3'
        );

        if (process.env.BOT_DEBUG === 'true') console.log(
            '[SONG] Output: ' + mp3File
        );

        await sock.sendMessage(chatId, {
            text:
                '🎵 Downloading:\n' +
                title +
                '\n\n' +
                '⏳ Please wait...'
        });

        await downloadYouTubeAudio(
            videoUrl,
            mp3File
        );

        if (process.env.BOT_DEBUG === 'true') console.log(
            '[SONG] Sending to WhatsApp...'
        );

        await sock.sendMessage(chatId, {
            audio: {
                url: mp3File
            },
            mimetype: 'audio/mpeg',
            fileName: safeTitle + '.mp3',
            ptt: false
        });

        if (process.env.BOT_DEBUG === 'true') console.log(
            '[SONG] Sent successfully: ' + title
        );

        setTimeout(function () {
            try {
                if (fs.existsSync(mp3File)) {
                    fs.unlinkSync(mp3File);

                    if (process.env.BOT_DEBUG === 'true') console.log(
                        '[SONG] Deleted temporary file'
                    );
                }
            } catch (cleanupError) {
                if (process.env.BOT_DEBUG === 'true') console.log(
                    '[SONG] Cleanup warning: ' +
                    cleanupError.message
                );
            }
        }, 5000);

    } catch (error) {
        console.error(
            '[SONG] Error:',
            error
        );

        await sock.sendMessage(chatId, {
            text:
                '❌ Could not download the song.\n\n' +
                'Reason: ' +
                error.message
        }).catch(function () {});
    }
}

module.exports = songCommand;
