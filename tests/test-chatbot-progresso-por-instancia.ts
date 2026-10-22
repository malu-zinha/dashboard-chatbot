import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const supabaseServicePath = resolve('integrations/supabase/supabaseService.ts');
const engineerFlowPath = resolve('chatbot/flows/engineerProjectFlow.ts');

const supabaseService = readFileSync(supabaseServicePath, 'utf8');
const engineerFlow = readFileSync(engineerFlowPath, 'utf8');

assert.match(
  supabaseService,
  /async buscarProgressoArea\(\s*projetoId: string,\s*areaId: string \| number,\s*engProjetoId\?: string/,
  'buscarProgressoArea deve aceitar engProjetoId opcional'
);

assert.match(
  supabaseService,
  /if \(engProjetoId\)[\s\S]*query = query\.eq\('id', engProjetoId\)/,
  'buscarProgressoArea deve filtrar pela atribuicao quando engProjetoId for informado'
);

assert.match(
  supabaseService,
  /async buscarPavimentosComEtapas\(\s*projetoId: string,\s*areaId\?: string \| number,\s*engProjetoId\?: string/,
  'buscarPavimentosComEtapas deve aceitar engProjetoId opcional'
);

assert.match(
  supabaseService,
  /if \(engProjetoId\)[\s\S]*pavQuery = pavQuery\.eq\('eng_projeto_id', engProjetoId\)/,
  'buscarPavimentosComEtapas deve filtrar pavimentos pela instancia'
);

assert.match(
  supabaseService,
  /async buscarEtapasGlobais\(\s*projetoId: string,\s*areaId\?: string \| number,\s*engProjetoId\?: string/,
  'buscarEtapasGlobais deve aceitar engProjetoId opcional'
);

assert.match(
  supabaseService,
  /if \(engProjetoId\)[\s\S]*q = q\.eq\('eng_projeto_id', engProjetoId\)/,
  'buscarEtapasGlobais deve filtrar etapas globais pela instancia'
);

assert.match(
  supabaseService,
  /async marcarAreaConcluida\(\s*projetoId: string,\s*areaId: string \| number,\s*concluido = true,\s*engProjetoId\?: string/,
  'marcarAreaConcluida deve aceitar engProjetoId opcional'
);

assert.match(
  supabaseService,
  /p_eng_projeto_id: engProjetoId \?\? null/,
  'marcarAreaConcluida deve enviar p_eng_projeto_id para a RPC'
);

assert.match(
  engineerFlow,
  /this\.supabase\.buscarProgressoArea(?:OuFalha)?\(atrib\.projeto_id, String\(atrib\.area_id\), atrib\.id\)/,
  'fluxo deve calcular percentual da atribuicao usando eng_projeto_id'
);

// O filtro por pavimentos (filtrarAtribuicoesPendentes) era codigo morto e saiu; o filtro de
// pendentes usa o percentual ponderado da propria instancia (atrib.id).
assert.match(
  engineerFlow,
  /isPercentualPendente\(await this\.supabase\.buscarProgressoAreaOuFalha\(atrib\.projeto_id, String\(atrib\.area_id\), atrib\.id\)\)/,
  'filtro de pendentes deve usar o percentual da instancia'
);

assert.match(
  engineerFlow,
  /this\.supabase\.buscarProgressoArea(?:OuFalha)?\(atrib\.projeto_id, String\(atrib\.area_id\), atrib\.id\)/,
  'checagem de conclusao deve usar a instancia selecionada'
);

assert.match(
  engineerFlow,
  /area: atrib\.instancia_label \|\| area\?\.descricao \|\| ''/,
  'menu deve exibir instancia_label quando existir'
);

console.log('test-chatbot-progresso-por-instancia: OK');
