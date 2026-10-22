// =====================================================
// LÓGICA: Variantes de celular brasileiro (nono dígito)
// =====================================================
// O WhatsApp entrega muitos celulares brasileiros sem o 9 depois do DDD
// (+55 DDD XXXXXXXX). Quem é cadastrado no formato natural (+55 DDD 9XXXXXXXX)
// não batia na busca por igualdade exata. Em produção os engenheiros ativos
// estão todos sem o 9 e os cadastrados com o 9 ficaram inativos.
//
// Devolve o número recebido primeiro (a busca prefere a forma exata) e, para
// celular brasileiro, a outra forma. Fixo (começa com 2-5) e estrangeiro não
// ganham variante. Mantém o "+" se ele veio.
// =====================================================

export function variantesTelefoneBR(telefone: string): string[] {
  const mais = telefone.startsWith('+') ? '+' : '';
  const digitos = telefone.replace(/\D/g, '');

  if (!digitos.startsWith('55')) return [telefone];

  const ddd = digitos.slice(2, 4);
  const numero = digitos.slice(4);

  // Com o 9: 9 + 8 dígitos de celular (que começa com 6-9).
  if (numero.length === 9 && numero[0] === '9' && /[6-9]/.test(numero[1])) {
    return [telefone, `${mais}55${ddd}${numero.slice(1)}`];
  }

  // Sem o 9: 8 dígitos começando com 6-9 é celular antigo.
  if (numero.length === 8 && /[6-9]/.test(numero[0])) {
    return [telefone, `${mais}55${ddd}9${numero}`];
  }

  return [telefone];
}
