export function parseRevenueDisclosure(html, period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid target period');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [year, month] = period.split('-');
  const plain = html.replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const title = new RegExp(`TSMC ${months[Number(month) - 1]} ${year.split('').join('\\s*')} (Revenue|Sales) Report`, 'i').exec(plain);
  if (!title) throw new Error('Missing matching month/title');
  const section = plain.slice(title.index, title.index + 3500);
  const net = /Net\s+(?:Revenues?|Sales)\s+([\d,]+)(?:\s|$)/i.exec(section);
  if (!net || !/NT\$\s*million/i.test(section.slice(0, net.index)) || !/consolidated/i.test(section.slice(0, net.index))) throw new Error('Missing consolidated TWD-million table');
  const amount = Number(net[1].replaceAll(',', ''));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid revenue');
  return { amount, supportingExcerpt: `${title[0]}; consolidated net revenue ${net[1]}; NT$ million` };
}
