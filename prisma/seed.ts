import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed do banco de dados...');

  const adminHash = await bcrypt.hash('admin', 10);
  const ferramentaHash = await bcrypt.hash('ferramenta', 10);

  // 1. Criar ou atualizar usuário MASTER
  const master = await prisma.usuario.upsert({
    where: { login: 'admin' },
    update: {
      senha: adminHash,
      perfil: 'MASTER',
      ativo: true,
    },
    create: {
      nome: 'Administrador Master',
      login: 'admin',
      senha: adminHash,
      email: 'admin@ferramentaria.com.br',
      perfil: 'MASTER',
      ativo: true,
    },
  });
  console.log(`Usuário MASTER garantido: ${master.login}`);

  // 2. Criar ou atualizar usuário FERRAMENTEIRO
  const ferramenteiro = await prisma.usuario.upsert({
    where: { login: 'ferramenta' },
    update: {
      senha: ferramentaHash,
      perfil: 'FERRAMENTEIRO',
      ativo: true,
    },
    create: {
      nome: 'Ferramenteiro Operacional',
      login: 'ferramenta',
      senha: ferramentaHash,
      email: 'ferramenta@ferramentaria.com.br',
      perfil: 'FERRAMENTEIRO',
      ativo: true,
    },
  });
  console.log(`Usuário FERRAMENTEIRO garantido: ${ferramenteiro.login}`);

  // 3. Garantir a Empresa Principal (CPRT) e Empresa Terceira
  const empresasData = [
    {
      cnpj: '00.000.000/0001-91',
      razaoSocial: 'CPRT ENGENHARIA E CONSTRUÇÕES LTDA',
      ativo: true,
    },
    {
      cnpj: '12.345.678/0001-90',
      razaoSocial: 'LOCADORA DE FERRAMENTAS & EQUIPAMENTOS LTDA',
      ativo: true,
    },
  ];

  for (const emp of empresasData) {
    const existing = await prisma.empresa.findUnique({
      where: { cnpj: emp.cnpj },
    });
    if (!existing) {
      await prisma.empresa.create({ data: emp });
      console.log(`Empresa criada: ${emp.razaoSocial} (${emp.cnpj})`);
    } else {
      console.log(`Empresa já existente: ${emp.razaoSocial}`);
    }
  }

  // 4. Cadastrar 2 Ferramentarias distintas
  const ferramentariasData = [
    {
      descricao: 'Ferramentaria Central',
      localizacao: 'CPRT Central - Almoxarifado Principal',
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
