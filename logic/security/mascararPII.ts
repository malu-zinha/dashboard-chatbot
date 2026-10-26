// =====================================================
// Mascara dado pessoal antes de ir para o log
// =====================================================
// Os logs do Railway guardavam o telefone completo e o texto de cada
// mensagem. Para depurar basta saber de qual telefone veio (ultimos 4
// digitos) e o tamanho do texto.
// =====================================================

export function mascararTelefone(telefone: string | null | undefined): string {
  const digitos = String(telefone ?? '').replace(/\D/g, '');
  if (digitos.length < 4) return '***';
  return `***${digitos.slice(-4)}`;
}

export function resumoTexto(texto: string | null | undefined): string {
  return `[${String(texto ?? '').length} caracteres]`;
}
