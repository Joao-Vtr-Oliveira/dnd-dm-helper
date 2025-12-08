import { CalendarEvent, Season } from '../../models/calendar-model';

export const SEASONS: { id: Season; label: string; color: string }[] = [
	{ id: 'spring', label: 'Primavera', color: '#9ae6b4' },
	{ id: 'summer', label: 'Verão', color: '#f6e05e' },
	{ id: 'autumn', label: 'Outono', color: '#f6ad55' },
	{ id: 'winter', label: 'Inverno', color: '#90cdf4' },
];

export const CALENDAR_EVENTS: CalendarEvent[] = [
	// PRIMAVERA
	{
		id: 'spring-1-luuren',
		season: 'spring',
		day: 1,
		deity: 'luuren',
		title: 'Gratidão a Luuren',
		description:
			'Despedida do inverno e agradecimento a Luuren pelo novo ciclo; casas e ruas decoradas com flores invernais.',
		tags: ['festival'],
	},
	{
		id: 'spring-10-atronos',
		season: 'spring',
		day: 10,
		deity: 'atronos',
		title: 'Dia da Criatividade',
		description:
			'Celebração de Atronos: histórias, invenções, novos pratos e tudo que envolve criatividade e conhecimento.',
		tags: ['festival'],
	},
	{
		id: 'spring-18-florescer-espiritual',
		season: 'spring',
		day: 18,
		title: 'Florescer Espiritual',
		description:
			'Véu entre mundo material e espiritual mais fino; músicas sobre os mortos, barracas de comida e lembranças dos entes queridos.',
		tags: ['espiritual', 'grande-festival'],
	},
	{
		id: 'spring-22-bondade',
		season: 'spring',
		day: 22,
		title: 'Dia da Bondade',
		description: 'Doações, grandes banquetes comunitários e ajuda aos necessitados.',
		tags: ['bondade', 'comunidade'],
	},
	{
		id: 'spring-30-despedida-primavera',
		season: 'spring',
		day: 30,
		title: 'Despedida da Primavera',
		description: 'Agradecimento pela primavera e chegada do verão; muitas flores e muita bebida.',
		tags: ['festival'],
	},

	// VERÃO
	{
		id: 'summer-1-pulacc',
		season: 'summer',
		day: 1,
		deity: 'pulacc',
		title: 'Dia de Pulacc',
		description: 'Banquetes e festas celebrando o sol, a alegria e as noites curtas do verão.',
		tags: ['festival'],
	},
	{
		id: 'summer-7-dreyc',
		season: 'summer',
		day: 7,
		deity: 'dreyc',
		title: 'Dia de Dreyc',
		description: 'Pessoas vestem branco, escrevem poesias e celebram relacionamentos.',
		tags: ['relacionamentos'],
	},
	{
		id: 'summer-18-geraldo',
		season: 'summer',
		day: 18,
		deity: 'geraldo',
		title: 'Dia de Geraldo',
		description:
			'Data temida: pessoas evitam sair de casa e rezam para escapar da desgraça de Geraldo.',
		tags: ['perigoso'],
	},
	{
		id: 'summer-24-dia-da-alegria',
		season: 'summer',
		day: 24,
		deity: 'pulacc',
		title: 'Dia da Alegria',
		description: 'Festas, abraços e demonstrações de carinho, dia preferido de Pulacc.',
		tags: ['festival'],
	},
	{
		id: 'summer-30-despedida-verao',
		season: 'summer',
		day: 30,
		title: 'Reflexão de Fim de Verão',
		description: 'Despedida do calor e reflexão em contato com a natureza.',
		tags: ['reflexao'],
	},

	// OUTONO
	{
		id: 'autumn-1-chegada-outono',
		season: 'autumn',
		day: 1,
		title: 'Chegada do Outono',
		description: 'Despedida do verão e celebração da época das safras e frutas.',
		tags: ['colheita'],
	},
	{
		id: 'autumn-19-achos',
		season: 'autumn',
		day: 19,
		deity: 'achos',
		title: 'Dia de Achos',
		description: 'Brincadeiras, pequenas mentiras e sustos entre as pessoas.',
		tags: ['travessuras'],
	},
	{
		id: 'autumn-27-luuren',
		season: 'autumn',
		day: 27,
		deity: 'luuren',
		title: 'Gratidão pelas Colheitas',
		description: 'Festas em agradecimento a Luuren pelas colheitas e fertilidade.',
		tags: ['colheita', 'festival'],
	},
	{
		id: 'autumn-30-despedida-outono',
		season: 'autumn',
		day: 30,
		title: 'Preparação para o Inverno',
		description: 'Estoque de comida, lenha, preparação das estufas e correria geral.',
		tags: ['preparacao'],
	},

	// INVERNO
	{
		id: 'winter-1-luna',
		season: 'winter',
		day: 1,
		deity: 'luna',
		title: 'Dia de Luna',
		description:
			'Chegada do inverno; noites mais longas, casas enfeitadas com plantas brancas e símbolos de lua.',
		tags: ['inverno', 'festival'],
	},
	{
		id: 'winter-6-vozc-ruuz',
		season: 'winter',
		day: 6,
		deity: 'ruuz',
		title: 'Dia do Equilíbrio',
		description: 'Celebração de Vozc e Ruuz em torno de fogueiras ou feiras nas cidades maiores.',
		tags: ['equilibrio'],
	},
	{
		id: 'winter-25-presentes',
		season: 'winter',
		day: 25,
		title: 'Dia dos Presentes',
		description: 'Presentes para pessoas queridas e grandes refeições.',
		tags: ['presentes', 'familia'],
	},
	{
		id: 'winter-30-fim-de-ano',
		season: 'winter',
		day: 30,
		deity: 'luna',
		title: 'Grande Festança de Luna',
		description: 'Fim do inverno e agradecimento por mais um ano; grandes festas e muita bebida.',
		tags: ['ano-novo', 'festival'],
	},
];
