/** Minúsculas, sem acento e com espaços simples. As regras comparam texto já normalizado. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Procura o padrão como palavra ou frase, não como pedaço de outra palavra.
 * "posto" encontra "POSTO Exemplo" e não encontra "depósito".
 * Maiúsculas e acentos são ignorados.
 */
export function contemPadrao(descricao: string, padrao: string): boolean {
  const texto = normalizar(descricao);
  const alvo = normalizar(padrao);
  if (!alvo) return false;
  const escapado = alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<![a-z0-9])${escapado}(?![a-z0-9])`, 'i');
  return regex.test(texto);
}
