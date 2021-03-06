const TAGS = {
	'': ['<em>', '</em>'],
	_: ['<strong>', '</strong>'],
	'~': ['<s>', '</s>'],
	'\n': ['<br />'],
	' ': ['<br />'],
	'-': ['<hr />']
};

/** Outdent a string based on the first indented line's leading whitespace
 *	@private
 */
function outdent(str) {
	return str.replace(RegExp('^' + (str.match(/^(\t| )+/) || '')[0], 'gm'), '');
}

/** Encode special attribute characters to HTML entities in a String.
 *	@private
 */
function encodeAttr(str) {
	return (str + '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Parse Markdown into an HTML String. */
export default function parse(md, prevLinks, opts) {

	const OPTIONS = Object.assign({
		indentBlocks: true,
		links: true,
		images: true,
		headings: true,
		code: true,
		replaceCodeWithEmoji: null,
		inline: true
	}, opts);

	let tokenizer = /((?:^|\n+)(?:\n---+|\* \*(?: \*)+)\n)|(?:^``` *(\w*)\n([\s\S]*?)\n```$)|((?:(?:^|\n+)(?:\t|  {2,}).+)+\n*)|((?:(?:^|\n)([>*+-]|\d+\.)\s+.*)+)|(?:\!\[([^\]]*?)\]\(([^\)]+?)\))|(\[)|(\](?:\(([^\)]+?)\))?)|(?:(?:^|\n+)([^\s].*)\n(\-{3,}|={3,})(?:\n+|$))|(?:(?:^|\n+)(#{1,6})\s*(.+)(?:\n+|$))|(?:`([^`].*?)`)|(  \n\n*|\n{2,}|__|\*\*|[_*]|~~)/gm,
		context = [],
		out = '',
		links = prevLinks || {},
		last = 0,
		chunk, prev, token, inner, t;

	function tag(token) {
		var desc = TAGS[token.replace(/\*/g, '_')[1] || ''],
			end = context[context.length - 1] == token;
		if (!desc) return token;
		if (!desc[1]) return desc[0];
		context[end ? 'pop' : 'push'](token);
		return desc[end | 0];
	}

	function flush() {
		let str = '';
		while (context.length) str += tag(context[context.length - 1]);
		return str;
	}

	md = md.replace(/^\[(.+?)\]:\s*(.+)$/gm, (s, name, url) => {
		links[name.toLowerCase()] = url;
		return '';
	}).replace(/^\n+|\n+$/g, '');

	while ((token = tokenizer.exec(md))) {
		prev = md.substring(last, token.index);
		last = tokenizer.lastIndex;
		chunk = token[0];
		if (prev.match(/[^\\](\\\\)*\\$/)) {
			// escaped
		}
		// Code/Indent blocks:
		else if (OPTIONS.code !== false && (token[3] || token[4])) {
			chunk = (OPTIONS.replaceCodeWithEmoji) ? `${OPTIONS.replaceCodeWithEmoji}` : '<pre class="code ' + (token[4] ? 'poetry' : token[2].toLowerCase()) + '">' + outdent(encodeAttr(token[3] || token[4]).replace(/^\n+|\n+$/g, '')) + '</pre>';
		}
		// > Quotes, -* lists:
		else if (OPTIONS.quotesAndLists !== false && token[6]) {
			t = token[6];
			if (t.match(/\./)) {
				token[5] = token[5].replace(/^\d+/gm, '');
			}
			inner = parse(outdent(token[5].replace(/^\s*[>*+.-]/gm, '')), null, OPTIONS);
			if (t === '>') t = 'blockquote';
			else {
				t = t.match(/\./) ? 'ol' : 'ul';
				inner = inner.replace(/^(.*)(\n|$)/gm, '<li>$1</li>');
			}
			chunk = '<' + t + '>' + inner + '</' + t + '>';
		}
		// Images:
		else if (OPTIONS.images !== false && token[8]) {
			chunk = `<img src="${encodeAttr(token[8])}" alt="${encodeAttr(token[7])}">`;
		}
		// Links:
		else if (OPTIONS.links !== false && token[10]) {
			let url = encodeAttr(token[11] || links[prev.toLowerCase()]);
			// Check if the URL has a protocol
			if (url.search(/^http[s]?\:\/\//) === -1) {
				if (/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(url)) {
					url = `mailto:${url}`;
				} else {
					url = `http://${url}`;
				}
			}
			out = out.replace('<a>', `<a href="#" onclick="window.open('${url}', '_system')">`);
			// If no link text is specified just use the raw URL
			const text = flush() || token[11];
			chunk = text + '</a>';
		}
		else if (OPTIONS.links !== false && token[9]) {
			chunk = '<a>';
		}
		// Headings:
		else if (OPTIONS.headings !== false && (token[12] || token[14])) {
			t = 'h' + (token[14] ? token[14].length : (token[13][0] === '=' ? 1 : 2));
			chunk = '<' + t + '>' + parse(token[12] || token[15], links, OPTIONS) + '</' + t + '>';
		}
		// `code`:
		else if (OPTIONS.code !== false && token[16]) {
			chunk = (OPTIONS.replaceCodeWithEmoji) ? `${OPTIONS.replaceCodeWithEmoji}` : '<code>' + encodeAttr(token[16]) + '</code>';
		}
		// Inline formatting: *em*, **strong** & friends
		else if (OPTIONS.inline !== false && (token[17] || token[1])) {
			chunk = tag(token[17] || '--');
		}
		out += prev;
		out += chunk;
	}

	return (out + md.substring(last) + flush()).trim();
}
