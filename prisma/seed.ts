import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  const passwordHash = await bcrypt.hash('Dimep@123', 10);

  // 1. Criar ou atualizar usuário MASTER
  const master = await prisma.usuario.upsert({
    where: { login: 'admin' },
    update: {
      senha: passwordHash,
      perfil: 'MASTER',
      ativo: true,
    },
    create: {
      nome: 'Administrador Master',
      login: 'admin',
      senha: passwordHash,
      email: 'admin@ferramentaria.com.br',
      perfil: 'MASTER',
      ativo: true,
    },
  });
  console.log(`Usuário MASTER garantido: ${master.login}`);

  // 2. Criar ou atualizar usuário FERRAMENTEIRO
  const ferramenteiro = await prisma.usuario.upsert({
    where: { login: 'operador' },
    update: {
      senha: passwordHash,
      perfil: 'FERRAMENTEIRO',
      ativo: true,
    },
    create: {
      nome: 'Ferramenteiro Canteiro',
      login: 'operador',
      senha: passwordHash,
      email: 'operador@ferramentaria.com.br',
      perfil: 'FERRAMENTEIRO',
      ativo: true,
    },
  });
  console.log(`Usuário FERRAMENTEIRO garantido: ${ferramenteiro.login}`);

  // 3. Cadastrar 2 Ferramentarias distintas
  const ferramentariasData = [
    {
      descricao: 'Ferramentaria Central',
      localizacao: 'Canteiro Central - Almoxarifado Principal',
      ativo: true,
    },
    {
      descricao: 'Ferramentaria Frente de Obra 02',
      localizacao: 'Eixo Sul - Km 42 (Apoio de Campo)',
      ativo: true,
    },
  ];

  for (const f of ferramentariasData) {
    const existing = await prisma.ferramentaria.findFirst({
      where: { descricao: f.descricao },
    });
    if (!existing) {
      await prisma.ferramentaria.create({ data: f });
      console.log(`Ferramentaria criada: ${f.descricao}`);
    } else {
      console.log(`Ferramentaria já existente: ${f.descricao}`);
    }
  }

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
