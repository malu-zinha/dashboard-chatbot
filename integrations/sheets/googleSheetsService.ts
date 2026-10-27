import { google } from 'googleapis';

export interface SheetData {
  headers: string[];
  rows: any[][];
}

export class GoogleSheetsService {
  private sheets;
  private auth;

  constructor() {
    // Autenticação com API Key (simples) ou OAuth2
    this.auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Caminho para credentials.json
      scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Permissão de leitura E escrita
    });
    
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Converte número de coluna (1-based) para letra(s) (A, B, ..., Z, AA, AB, ...)
   * @param columnNumber - Número da coluna (1 = A, 27 = AA)
   */
  private columnNumberToLetter(columnNumber: number): string {
    let letter = '';
    while (columnNumber > 0) {
      const remainder = (columnNumber - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return letter;
  }

  /**
   * Lê dados de uma planilha do Google Sheets
   * @param spreadsheetId - ID da planilha (da URL)
   * @param range - Range de células (ex: 'Sheet1!A1:Z100')
   */
  async readSheet(spreadsheetId: string, range: string = 'A1:Z1000'): Promise<SheetData> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        return { headers: [], rows: [] };
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      return { headers, rows: dataRows };
    } catch (error: any) {
      console.error('Erro ao ler Google Sheets:', error.message);
      throw new Error(`Falha ao ler planilha: ${error.message}`);
    }
  }

  /**
   * Lê dados com headers de um range separado
   * Útil quando headers estão em linhas diferentes dos dados
   * @param spreadsheetId - ID da planilha
   * @param dataRange - Range dos dados (ex: 'Sheet1!A3:Z1000')
   * @param headerRange - Range dos headers (ex: 'Sheet1!A2:Z2')
   */
  async readSheetWithSeparateHeaders(
    spreadsheetId: string,
    dataRange: string,
    headerRange: string
  ): Promise<SheetData> {
    try {
      // Ler headers
      const headerResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: headerRange,
      });
      const headerRows = headerResponse.data.values || [];
      const headers = headerRows.length > 0 ? headerRows[0] : [];

      // Ler dados
      const dataResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: dataRange,
      });
      const rows = dataResponse.data.values || [];

      return { headers, rows };
    } catch (error: any) {
      console.error('Erro ao ler Google Sheets:', error.message);
      throw new Error(`Falha ao ler planilha: ${error.message}`);
    }
  }

  /**
   * Lê dados e converte em array de objetos
   */
  async readSheetAsObjects(spreadsheetId: string, range: string = 'A1:Z1000'): Promise<any[]> {
    const { headers, rows } = await this.readSheet(spreadsheetId, range);
    
    return rows.map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        // Normalizar headers para padronizar entre abas
        let normalizedHeader = header;
        
        // "." vira "Nº"
        if (header === '.') {
          normalizedHeader = 'Nº';
        }
        // "Data de início" vira "Data De Início"
        else if (header.toLowerCase() === 'data de início') {
          normalizedHeader = 'Data De Início';
        }
        
        obj[normalizedHeader] = row[index] || '';
      });
      return obj;
    });
  }

  /**
   * Lê dados com headers separados e converte em array de objetos
   */
  async readSheetAsObjectsWithSeparateHeaders(
    spreadsheetId: string,
    dataRange: string,
    headerRange: string
  ): Promise<any[]> {
    const { headers, rows } = await this.readSheetWithSeparateHeaders(
      spreadsheetId,
      dataRange,
      headerRange
    );
    
    return rows.map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        // Normalizar headers para padronizar entre abas
        let normalizedHeader = header;
        
        // "." vira "Nº"
        if (header === '.') {
          normalizedHeader = 'Nº';
        }
        // "Data de início" vira "Data De Início"
        else if (header.toLowerCase() === 'data de início') {
          normalizedHeader = 'Data De Início';
        }
        
        obj[normalizedHeader] = row[index] || '';
      });
      return obj;
    });
  }

  /**
   * Busca linha pelo ID (campo Nº ou Código do Projeto)
   * @param spreadsheetId - ID da planilha
   * @param sheetName - Nome da aba
   * @param projectId - ID do projeto (ex: PRJ-001)
   * @param range - Range de busca
   * @param idColumnName - Nome da coluna de ID (padrão: 'Nº', nova planilha: 'Código do Projeto')
   * @returns Objeto com rowIndex (índice da linha no array de dados, começando em 0) e data (dados da linha)
   */
  async findRowByID(
    spreadsheetId: string,
    sheetName: string,
    projectId: string,
    range: string = 'A1:Z1000',
    idColumnName: string = 'Nº',
    headerRange?: string
  ): Promise<{ rowIndex: number; actualRowNumber: number; data: any } | null> {
    try {
      const fullRange = `${sheetName}!${range}`;
      let data: any[];

      if (headerRange) {
        // Usar headers separados se fornecido
        const fullHeaderRange = `${sheetName}!${headerRange}`;
        data = await this.readSheetAsObjectsWithSeparateHeaders(
          spreadsheetId,
          fullRange,
          fullHeaderRange
        );
      } else {
        // Método tradicional: primeira linha do range é o header
        data = await this.readSheetAsObjects(spreadsheetId, fullRange);
      }
      
      // Procurar pela coluna de ID especificada
      const rowIndex = data.findIndex(row => row[idColumnName] === projectId);
      
      if (rowIndex === -1) {
        console.log(`⚠️ Projeto ${projectId} não encontrado na coluna '${idColumnName}'`);
        return null;
      }
      
      // Extrair o número da linha inicial do range (ex: A2:H1000 → linha inicial = 2, A3:H1000 → 3)
      const rangeMatch = range.match(/^[A-Z]+(\d+):/);
      const startRow = rangeMatch ? parseInt(rangeMatch[1], 10) : 1;
      
      // Se usamos headers separados, startRow já é a primeira linha de dados
      // rowIndex=0 → startRow, rowIndex=1 → startRow+1, etc.
      const actualRowNumber = headerRange ? startRow + rowIndex : startRow + rowIndex + 1;
      
      return { 
        rowIndex, 
        actualRowNumber,
        data: data[rowIndex] 
      };
    } catch (error: any) {
      console.error('Erro ao buscar linha por ID:', error.message);
      return null;
    }
  }

  /**
   * Atualiza uma linha completa
   * @param spreadsheetId - ID da planilha
   * @param sheetName - Nome da aba
   * @param rowNumber - Número da linha (começa em 1, incluindo header)
   * @param values - Objeto com valores {campo: valor} ou array de valores
   * @param headers - Headers da planilha (necessário se values for objeto)
   */
  async updateRow(
    spreadsheetId: string,
    sheetName: string,
    rowNumber: number,
    values: any[] | Record<string, any>,
    headers?: string[]
  ): Promise<boolean> {
    try {
      let rowData: any[];
      
      if (Array.isArray(values)) {
        rowData = values;
      } else {
        // Converter objeto para array baseado nos headers
        if (!headers) {
          throw new Error('Headers são necessários quando values é um objeto');
        }
        
        rowData = headers.map(header => {
          // Desnormalizar: mapear headers da planilha para dados normalizados
          let value = values[header];
          
          // Se não encontrou, tentar mapeamentos
          if (value === undefined) {
            // "." → "Nº"
            if (header === '.') {
              value = values['Nº'];
            }
            // "Data de início" → "Data De Início"
            else if (header.toLowerCase() === 'data de início') {
              value = values['Data De Início'];
            }
          }
          
          return value !== undefined ? value : '';
        });
      }
      
      const lastColumn = this.columnNumberToLetter(rowData.length);
      const range = `${sheetName}!A${rowNumber}:${lastColumn}${rowNumber}`;
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData]
        }
      });
      
      console.log(`✅ Linha ${rowNumber} atualizada na aba ${sheetName}`);
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar linha:', error.message);
      return false;
    }
  }

  /**
   * Atualiza campos específicos de uma linha pelo ID do projeto
   * @param spreadsheetId - ID da planilha
   * @param sheetName - Nome da aba
   * @param projectId - ID do projeto
   * @param updates - Objeto com campos a atualizar {campo: novoValor}
   * @param range - Range de busca
   * @param idColumnName - Nome da coluna de ID (padrão: 'Nº', nova planilha: 'Código do Projeto')
   */
  async updateRowByID(
    spreadsheetId: string,
    sheetName: string,
    projectId: string,
    updates: Record<string, any>,
    range: string = 'A1:Z1000',
    idColumnName: string = 'Nº',
    headerRange?: string
  ): Promise<boolean> {
    try {
      // Buscar a linha (passando o nome da coluna de ID e headerRange se fornecido)
      const result = await this.findRowByID(
        spreadsheetId, 
        sheetName, 
        projectId, 
        range, 
        idColumnName,
        headerRange
      );
      
      if (!result) {
        console.error(`Projeto ${projectId} não encontrado na aba ${sheetName}`);
        return false;
      }
      
      // Obter headers (do headerRange se fornecido, senão do range de dados)
      let headers: string[];
      if (headerRange) {
        const fullHeaderRange = `${sheetName}!${headerRange}`;
        const headerData = await this.readSheet(spreadsheetId, fullHeaderRange);
        headers = headerData.headers;
      } else {
      const fullRange = `${sheetName}!${range}`;
        const rangeData = await this.readSheet(spreadsheetId, fullRange);
        headers = rangeData.headers;
      }
      
      // Mesclar dados existentes com updates
      const updatedData = { ...result.data, ...updates };
      
      // Atualizar a linha
      return await this.updateRow(
        spreadsheetId,
        sheetName,
        result.actualRowNumber,
        updatedData,
        headers
      );
    } catch (error: any) {
      console.error('Erro ao atualizar linha por ID:', error.message);
      return false;
    }
  }

  /**
   * Adiciona uma nova linha no final da planilha
   * @param spreadsheetId - ID da planilha
   * @param sheetName - Nome da aba
   * @param values - Array de valores ou objeto {campo: valor}
   * @param headers - Headers da planilha (necessário se values for objeto)
   */
  async addRow(
    spreadsheetId: string,
    sheetName: string,
    values: any[] | Record<string, any>,
    headers?: string[]
  ): Promise<boolean> {
    try {
      let rowData: any[];
      
      if (Array.isArray(values)) {
        rowData = values;
      } else {
        // Converter objeto para array baseado nos headers
        if (!headers) {
          throw new Error('Headers são necessários quando values é um objeto');
        }
        rowData = headers.map(header => values[header] ?? '');
        console.log(`🔍 DEBUG addRow - Mapeando ${headers.length} headers para ${rowData.length} valores`);
        console.log(`🔍 DEBUG addRow - Primeiros valores:`, rowData.slice(0, 5));
      }
      
      const range = `${sheetName}!A:A`; // Append na coluna A
      
      console.log(`🔍 DEBUG addRow - Range: ${range}, Valores: ${rowData.length} colunas`);
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [rowData]
        }
      });
      
      console.log(`✅ Nova linha adicionada na aba ${sheetName}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao adicionar linha:', error.message);
      console.error('Stack:', error.stack);
      return false;
    }
  }

  /**
   * Obtém headers de uma aba específica
   */
  async getHeaders(spreadsheetId: string, sheetName: string): Promise<string[]> {
    try {
      const range = `${sheetName}!1:1`;
      const { headers } = await this.readSheet(spreadsheetId, range);
      return headers;
    } catch (error: any) {
      console.error('Erro ao obter headers:', error.message);
      return [];
    }
  }

  // =====================================================
  // MÉTODOS PARA SINCRONIZAÇÃO (Supabase → Sheets)
  // =====================================================

  /**
   * Limpar dados de um range (mantém headers se começar em A2)
   */
  async clearSheet(spreadsheetId: string, range: string): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });
    } catch (error: any) {
      console.error('Erro ao limpar planilha:', error.message);
      throw error;
    }
  }

  /**
   * Escrever múltiplas linhas de uma vez
   */
  async writeSheet(spreadsheetId: string, range: string, values: any[][]): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });
    } catch (error: any) {
      console.error('Erro ao escrever na planilha:', error.message);
      throw error;
    }
  }

}

// Singleton para reutilizar instância
let sheetsServiceInstance: GoogleSheetsService | null = null;

export function getGoogleSheetsService(): GoogleSheetsService {
  if (!sheetsServiceInstance) {
    sheetsServiceInstance = new GoogleSheetsService();
  }
  return sheetsServiceInstance;
}

