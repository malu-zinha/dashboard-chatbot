import { describe, it, expect, beforeAll } from 'vitest';
import { SupabaseService } from '../../../integrations/supabase/supabaseService';

/**
 * Testes de integração para pavimentos/etapas seedados por área.
 *
 * Requer conexão ao Supabase e pelo menos um projeto com atribuições
 * ativas nas áreas ELETRICO e HIDRAULICO.
 *
 * Rodar com:
 *   npx vitest run tests/integration/pavimentos-etapas-por-area.test.ts
 */
describe('Pavimentos/Etapas por área', () => {
  const svc = new SupabaseService();
  let projetoTeste: string;
  let areaEletrico: number;
  let areaHidraulico: number;

  beforeAll(async () => {
    await svc.connect();

    // Buscar area_ids reais
    const { data: areas } = await (svc as any).supabase
      .from('areas')
      .select('area_id, codigo')
      .in('codigo', ['ELETRICO', 'HIDRAULICO']);

    if (!areas || areas.length < 2) {
      throw new Error('Áreas ELETRICO e HIDRAULICO não encontradas no banco.');
    }

    areaEletrico = areas.find((a: any) => a.codigo === 'ELETRICO').area_id;
    areaHidraulico = areas.find((a: any) => a.codigo === 'HIDRAULICO').area_id;

    // Buscar um projeto que tenha pavimentos seedados para ambas as áreas
    const { data: pavEletrico } = await (svc as any).supabase
      .from('projeto_pavimentos')
      .select('projeto_id')
      .eq('area_id', areaEletrico)
      .eq('ativo', true)
      .limit(1)
      .single();

    const { data: pavHidraulico } = await (svc as any).supabase
      .from('projeto_pavimentos')
      .select('projeto_id')
      .eq('area_id', areaHidraulico)
      .eq('ativo', true)
      .limit(1)
      .single();

    if (!pavEletrico || !pavHidraulico) {
      throw new Error(
        'Nenhum projeto encontrado com pavimentos seedados para ELETRICO e HIDRAULICO. ' +
        'Execute a migration de backfill primeiro.'
      );
    }

    // Usar o projeto de Elétrico para os testes
    // (os testes são independentes — cada um busca pelo seu area_id)
    projetoTeste = pavEletrico.projeto_id;
  });

  it('seedou pavimentos distintos para Elétrico vs Hidráulico', async () => {
    const eletrico = await svc.buscarPavimentosComEtapas(projetoTeste, areaEletrico);
    const hidraulico = await svc.buscarPavimentosComEtapas(projetoTeste, areaHidraulico);

    expect(eletrico.length).toBeGreaterThan(0);
    // Hidráulico pode estar em outro projeto; verificar separadamente
    if (hidraulico.length > 0) {
      // Elétrico tem 'Energisa', Hidráulico não
      expect(eletrico.map((p: any) => p.nome)).toContain('Energisa');
      expect(hidraulico.map((p: any) => p.nome)).not.toContain('Energisa');
    }

    // Etapas por pavimento também devem ser diferentes
    const etapasEletrico = eletrico.flatMap((p: any) => p.etapas.map((e: any) => e.nome));
    expect(etapasEletrico).toContain('Eletrodutos');
    expect(etapasEletrico).not.toContain('Isométricos'); // Isométricos é do Hidráulico
  });

  it('soma de pesos respeita invariante (nível 1 = 100, nível 2 = 100)', async () => {
    const pav = await svc.buscarPavimentosComEtapas(projetoTeste, areaEletrico);
    const glb = await svc.buscarEtapasGlobais(projetoTeste, areaEletrico);

    // Nível 1: pavimentos + etapas globais = 100
    const somaN1 = pav.reduce((s: number, p: any) => s + Number(p.peso), 0)
                 + glb.reduce((s: number, g: any) => s + Number(g.peso), 0);
    expect(Math.round(somaN1 * 100) / 100).toBe(100);

    // Nível 2: etapas dentro de cada pavimento = 100
    for (const p of pav) {
      const etapas = p.etapas || [];
      if (etapas.length === 0) continue;
      const somaN2 = etapas.reduce((s: number, e: any) => s + Number(e.peso), 0);
      expect(Math.round(somaN2 * 100) / 100).toBe(100);
    }
  });
});
