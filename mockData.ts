import { UserRole, Product, Table, TableStatus, User } from './src/types';

export const INITIAL_USERS: User[] = [
  // Superadmin uniquement - Les autres users sont dans Firebase
  { id: 'u-superadmin', firstName: 'Superadmin', lastName: 'LR', email: 'superadmin@deflower.fr', role: UserRole.ADMIN, pin: '1357', isActive: true },
];

export const INITIAL_PRODUCTS: Product[] = [
  // CHAMPAGNE BRUT
  { id: 'c1', name: 'Belle Epoque', category: 'Champagne Brut', prices: { standard: 550 } },
  { id: 'c2', name: 'Dom Pérignon', category: 'Champagne Brut', prices: { standard: 650, magnum: 1500, jeroboam: 8000, mathusalem: 25000 } },
  { id: 'c3', name: 'Armand De Brignac', category: 'Champagne Brut', prices: { standard: 650, magnum: 1300, jeroboam: 7500 } },
  { id: 'c4', name: 'Cristal', category: 'Champagne Brut', prices: { standard: 700, magnum: 1600, jeroboam: 9000, mathusalem: 35000 } },

  // CHAMPAGNE ROSÉ
  { id: 'cr1', name: 'Dom Pérignon Rosé', category: 'Champagne Rosé', prices: { standard: 1300, magnum: 2500, jeroboam: 16000, mathusalem: 55000 } },
  { id: 'cr2', name: 'Dom Pérignon Lady Gaga', category: 'Champagne Rosé', prices: { standard: 1500, magnum: 3000, jeroboam: 20000 } },
  { id: 'cr3', name: 'Armand De Brignac Rosé', category: 'Champagne Rosé', prices: { standard: 1300, magnum: 2400, jeroboam: 18000 } },
  { id: 'cr4', name: 'Cristal Rosé', category: 'Champagne Rosé', prices: { standard: 1300, magnum: 2700 } },

  // VODKA
  { id: 'v1', name: 'Grey Goose', category: 'Vodka', prices: { standard: 320, magnum: 620 } },
  { id: 'v2', name: 'Altius', category: 'Vodka', prices: { standard: 650, magnum: 1220 } },
  { id: 'v3', name: 'Beluga Gold Line', category: 'Vodka', prices: { standard: 700, magnum: 1500 } },
  { id: 'v4', name: 'Belvedere TEN', category: 'Vodka', prices: { standard: 650 } },

  // WHISKY
  { id: 'w1', name: 'Jack Daniel\'s', category: 'Whisky', prices: { standard: 320, magnum: 600 } },
  { id: 'w2', name: 'Chivas Regal 12 Ans', category: 'Whisky', prices: { standard: 350 } },
  { id: 'w3', name: 'Chivas XV', category: 'Whisky', prices: { standard: 400 } },
  { id: 'w4', name: 'Sir Davis', category: 'Whisky', prices: { standard: 500 } },
  { id: 'w5', name: 'Johnnie Walker Black Label', category: 'Whisky', prices: { standard: 350 } },
  { id: 'w6', name: 'Johnnie Walker Blue Label', category: 'Whisky', prices: { standard: 800 } },

  // TEQUILA
  { id: 'tq1', name: 'Patrón Añejo', category: 'Tequila', prices: { standard: 420 } },
  { id: 'tq2', name: 'Patrón Cafe', category: 'Tequila', prices: { standard: 420 } },
  { id: 'tq3', name: 'Patrón El Cielo', category: 'Tequila', prices: { standard: 800 } },
  { id: 'tq4', name: 'Casamigos Añejo', category: 'Tequila', prices: { standard: 620 } },
  { id: 'tq5', name: 'Don Julio 1942', category: 'Tequila', prices: { standard: 1300, magnum: 2800 } },
  { id: 'tq6', name: 'Clase Azul Reposado', category: 'Tequila', prices: { standard: 1100, magnum: 2500 } },
  { id: 'tq7', name: 'Clase Azul Gold', category: 'Tequila', prices: { standard: 2000 } },
  { id: 'tq8', name: 'Clase Azul Añejo', category: 'Tequila', prices: { standard: 2500 } },
  { id: 'tq9', name: 'Clase Azul Ultra', category: 'Tequila', prices: { standard: 10000 } },

  // GIN
  { id: 'g1', name: 'Bombay Sapphire', category: 'Gin', prices: { standard: 320 } },
  { id: 'g2', name: 'Tanqueray', category: 'Gin', prices: { standard: 320 } },
  { id: 'g3', name: 'Monkey 47', category: 'Gin', prices: { standard: 320 } },
  { id: 'g4', name: 'Hendricks', category: 'Gin', prices: { standard: 370 } },
  { id: 'g5', name: 'Seventy One', category: 'Gin', prices: { standard: 700 } },

  // RHUM
  { id: 'r1', name: 'Eminente 3 Ans', category: 'Rhum', prices: { standard: 320 } },
  { id: 'r2', name: 'Eminente 6 Ans', category: 'Rhum', prices: { standard: 520 } },
  { id: 'r3', name: 'Bumbu XO', category: 'Rhum', prices: { standard: 520 } },
  { id: 'r4', name: 'Bacardi Reserva 8', category: 'Rhum', prices: { standard: 370 } },
  { id: 'r5', name: 'Santa Teresa', category: 'Rhum', prices: { standard: 420 } },

  // COGNAC
  { id: 'co1', name: 'Hennessy VS', category: 'Cognac', prices: { standard: 400 } },
  { id: 'co2', name: 'Hennessy XO', category: 'Cognac', prices: { standard: 750 } },
  { id: 'co3', name: 'Martell Cordon Bleu', category: 'Cognac', prices: { standard: 750 } },
  { id: 'co4', name: 'Martell Blue Swift', category: 'Cognac', prices: { standard: 500 } },

  // PACK & DIVERS
  { id: 'd1', name: 'Redbull (x4)', category: 'DIVERS', prices: { standard: 20 } },
  { id: 'd2', name: 'Gingerbeer (x4)', category: 'DIVERS', prices: { standard: 20 } },
  { id: 'd3', name: 'Get 27', category: 'DIVERS', prices: { standard: 250 } },
  { id: 'd4', name: 'Puff', category: 'DIVERS', prices: { standard: 20, magnum: 30, jeroboam: 40 } },
  { id: 'd7', name: 'Clope', category: 'DIVERS', prices: { standard: 30 } },
];

export const INITIAL_TABLES: Table[] = [
  // =============================================
  // 🎵 ZONE CLUB - DEFLOWER
  // =============================================

  // Rangée du haut (tables 1-10)
  { id: 't1', number: '1', capacity: 6, type: 'vip', status: TableStatus.AVAILABLE, positionX: 7, positionY: 20, zone: 'club' },
  { id: 't2', number: '2', capacity: 6, type: 'vip', status: TableStatus.AVAILABLE, positionX: 16, positionY: 20, zone: 'club' },
  { id: 't3', number: '3', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 25, positionY: 20, zone: 'club' },
  { id: 't4', number: '4', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 34, positionY: 20, zone: 'club' },
  { id: 't5', number: '5', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 43, positionY: 20, zone: 'club' },
  { id: 't6', number: '6', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 52, positionY: 20, zone: 'club' },
  { id: 't7', number: '7', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 61, positionY: 20, zone: 'club' },
  { id: 't7b', number: '7b', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 64, positionY: 28, zone: 'club' },
  { id: 't8', number: '8', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 70, positionY: 20, zone: 'club' },
  { id: 't9', number: '9', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 79, positionY: 20, zone: 'club' },
  { id: 't10', number: '10', capacity: 8, type: 'vip', status: TableStatus.AVAILABLE, positionX: 89, positionY: 20, zone: 'club' },

  // Rangée du milieu (tables 22-26)
  { id: 't26', number: '26', capacity: 6, type: 'vip', status: TableStatus.AVAILABLE, positionX: 37, positionY: 46, zone: 'club' },
  { id: 't25', number: '25', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 51, positionY: 46, zone: 'club' },
  { id: 't25b', number: '25b', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 44, positionY: 54, zone: 'club' },
  { id: 't24', number: '24', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 62, positionY: 46, zone: 'club' },
  { id: 't23', number: '23', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 73, positionY: 46, zone: 'club' },
  { id: 't22', number: '22', capacity: 6, type: 'vip', status: TableStatus.AVAILABLE, positionX: 84, positionY: 46, zone: 'club' },
  { id: 't21', number: '21', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 84, positionY: 57, zone: 'club' },

  // Tables spéciales (PDJ, P1)
  { id: 't-pdj', number: 'PDJ', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 8, positionY: 53, zone: 'club' },
  { id: 't-p1', number: 'P1', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 19, positionY: 57, zone: 'club' },

  // Zone bas gauche (tables 30-31)
  { id: 't30', number: '30', capacity: 6, type: 'vip', status: TableStatus.AVAILABLE, positionX: 8, positionY: 72, zone: 'club' },
  { id: 't31', number: '31', capacity: 6, type: 'vip', status: TableStatus.AVAILABLE, positionX: 8, positionY: 81, zone: 'club' },

  // Zone bas centre-droite (tables 27, 28, 20)
  { id: 't27', number: '27', capacity: 6, type: 'vip', status: TableStatus.AVAILABLE, positionX: 37, positionY: 80, zone: 'club' },
  { id: 't28', number: '28', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 52, positionY: 80, zone: 'club' },
  { id: 't20', number: '20', capacity: 6, type: 'standard', status: TableStatus.AVAILABLE, positionX: 84, positionY: 80, zone: 'club' },

  // =============================================
  // 🍸 ZONE BAR (en longueur, alignées horizontalement)
  // =============================================
  { id: 'b1', number: 'BAR1', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 6, positionY: 50, zone: 'bar' },
  { id: 'b2', number: 'BAR2', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 18, positionY: 50, zone: 'bar' },
  { id: 'b3', number: 'BAR3', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 30, positionY: 50, zone: 'bar' },
  { id: 'b4', number: 'BAR4', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 42, positionY: 50, zone: 'bar' },
  { id: 'b5', number: 'BAR5', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 54, positionY: 50, zone: 'bar' },
  { id: 'b6', number: 'BAR6', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 66, positionY: 50, zone: 'bar' },
  { id: 'b7', number: 'BAR7', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 78, positionY: 50, zone: 'bar' },
  { id: 'b8', number: 'BAR8', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 88, positionY: 60, zone: 'bar' },
  { id: 'b9', number: 'BAR9', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 88, positionY: 70, zone: 'bar' },
  { id: 'b10', number: 'BAR10', capacity: 4, type: 'standard', status: TableStatus.AVAILABLE, positionX: 88, positionY: 80, zone: 'bar' },
];