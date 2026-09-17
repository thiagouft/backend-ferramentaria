import { FastifyRequest, FastifyReply } from 'fastify';
import { PessoasService } from './pessoas.service.js';
import { DimepSyncService } from './dimep-sync.service.js';
import { createPessoaSchema, updatePessoaSchema } from './pessoas.schemas.js';

const pessoasService = new PessoasService();
const dimepSyncService = new DimepSyncService();

export class PessoasController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as {
      search?: string;
      situacao?: string;
      ativo?: string;
      incluirInativos?: string;
    };

    const situacaoNum = query.situacao !== undefined && query.situacao !== '' ? Number(query.situacao) : undefined;
    const ativoBool = query.ativo !== undefined ? query.ativo === 'true' : undefined;
    const incluirInativosBool = query.incluirInativos === 'true';

    try {
      const pessoas = await pessoasService.listAll({
        search: query.search,
        situacao: situacaoNum,
        ativo: ativoBool,
        incluirInativos: incluirInativosBool,
      });
      return reply.status(200).send(pessoas);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  }

  async getByMatricula(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { matricula: string };
    try {
      const pessoa = await pessoasService.getByMatricula(params.matricula);
      return reply.status(200).send(pessoa);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createPessoaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const pessoa = await pessoasService.create(parseResult.data);
      return reply.status(201).send(pessoa);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { matricula: string };
    const parseResult = updatePessoaSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        details: parseResult.error.format(),
      });
    }

    try {
      const pessoa = await pessoasService.update(params.matricula, parseResult.data);
      return reply.status(200).send(pessoa);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  async toggleStatus(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { matricula: string };
    try {
      const pessoa = await pessoasService.toggleStatus(params.matricula);
      return reply.status(200).send(pessoa);
    } catch (error: any) {
      return reply.status(404).send({ message: error.message });
    }
  }

  async uploadXLS(request: FastifyRequest, reply: FastifyReply) {
    try {
      const fileData = await request.file();
      if (!fileData) {
        return reply.status(400).send({ message: 'Nenhum arquivo enviado.' });
      }

      const buffer = await fileData.toBuffer();
      const { countUpsert, countInativados } = await dimepSyncService.processBuffer(buffer);

      return reply.status(200).send({
        message: `Planilha processada com sucesso! ${countUpsert} colaboradores atualizados/criados e ${countInativados} inativados.`,
        countUpsert,
        countInativados,
      });
    } catch (error: any) {
      return reply.status(500).send({ message: `Erro ao processar planilha: ${error.message}` });
    }
  }

  async syncDimep(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await dimepSyncService.runDimepSync();
      return reply.status(200).send(result);
    } catch (error: any) {
      return reply.status(500).send({
        sucesso: false,
        message: error.message || 'Falha na sincronização com Dimep AMS.',
      });
    }
  }

  async getSyncInfo(request: FastifyRequest, reply: FastifyReply) {
    try {
      const info = await pessoasService.getLastSyncInfo();
      return reply.status(200).send(info);
    } catch (error: any) {
      return reply.status(500).send({ message: error.message });
    }
  }
}
