const { spawnSync } = require('node:child_process');

function hasRtk() {
	const result = spawnSync('rtk', ['--version'], {
		encoding: 'utf8',
		timeout: 2000,
	});
	return result.status === 0;
}

function rewriteCommand(command) {
	if (typeof command !== 'string' || !command.trim()) return null;
	if (/^(.*\/)?rtk\s/.test(command)) return null;
	if (command.includes('<<')) return null;

	const result = spawnSync('rtk', ['rewrite', command], {
		encoding: 'utf8',
		timeout: 2000,
	});

	const rewritten = (result.stdout || '').trim();
	if (!rewritten || rewritten === command) return null;

	return rewritten;
}

module.exports = async function openrtkPlugin() {
	if (!hasRtk()) {
		console.warn('[openrtk] rtk binary not found in PATH - plugin disabled');
		return {};
	}

	return {
		'tool.execute.before': async (input, output) => {
			const tool = String(input?.tool ?? '').toLowerCase();
			if (tool !== 'bash' && tool !== 'shell') return;

			const args = output?.args;
			if (!args || typeof args !== 'object') return;

			const command = args.command;
			const rewritten = rewriteCommand(command);
			if (rewritten) args.command = rewritten;
		},
	};
};
