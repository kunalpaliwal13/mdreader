// Base16 color schemes for the app chrome + editor. Swatches mirror src/schemes.css
// (copied from medusa/website/src/theme.ts) so the picker can preview without applying.

/** [background, red, amber, green, blue] */
type Swatch = [string, string, string, string, string];
export type Scheme = { id: string; name: string; swatch: Record<'dark' | 'light', Swatch> };

export const SCHEMES: Scheme[] = [
  { id: 'default', name: 'Default', swatch: {
    dark: ['#17171a', '#f87171', '#f59e0b', '#22c55e', '#8b8cf8'],
    light: ['#ffffff', '#dc2626', '#d97706', '#16a34a', '#5b5bd6'],
  } },
  { id: 'obsidian', name: 'Obsidian', swatch: {
    dark: ['#1E1E1E', '#FB464C', '#E0DE71', '#44CF6E', '#8A6CEF'],
    light: ['#FFFFFF', '#E93147', '#E0AC00', '#08B94E', '#7852EE'],
  } },
  { id: 'gruvbox', name: 'Gruvbox', swatch: {
    dark: ['#282828', '#FB4934', '#FABD2F', '#B8BB26', '#83A598'],
    light: ['#FBF1C7', '#9D0006', '#B57614', '#79740E', '#076678'],
  } },
  { id: 'tokyonight', name: 'Tokyo Night', swatch: {
    dark: ['#1A1B26', '#F7768E', '#E0AF68', '#9ECE6A', '#7AA2F7'],
    light: ['#E1E2E7', '#F52A65', '#8F5E15', '#587539', '#2E7DE9'],
  } },
  { id: 'catppuccin', name: 'Catppuccin', swatch: {
    dark: ['#1E1E2E', '#F38BA8', '#F9E2AF', '#A6E3A1', '#89B4FA'],
    light: ['#EFF1F5', '#D20F39', '#B8860B', '#40A02B', '#1E66F5'],
  } },
  { id: 'nord', name: 'Nord', swatch: {
    dark: ['#2E3440', '#BF616A', '#EBCB8B', '#A3BE8C', '#81A1C1'],
    light: ['#ECEFF4', '#A54049', '#8F6B0B', '#5E7A4A', '#5272A0'],
  } },
  { id: 'solarized', name: 'Solarized', swatch: {
    dark: ['#002B36', '#DC322F', '#B58900', '#859900', '#268BD2'],
    light: ['#FDF6E3', '#DC322F', '#8F6D00', '#667A00', '#268BD2'],
  } },
  { id: 'dracula', name: 'Dracula', swatch: {
    dark: ['#282A36', '#FF5555', '#F1FA8C', '#50FA7B', '#BD93F9'],
    light: ['#FFFBEB', '#CB3A2A', '#846E15', '#14710A', '#644AC9'],
  } },
  { id: 'onedark', name: 'One Dark', swatch: {
    dark: ['#282C34', '#E06C75', '#E5C07B', '#98C379', '#61AFEF'],
    light: ['#FAFAFA', '#CA1243', '#C18401', '#50A14F', '#4078F2'],
  } },
  { id: 'monokai', name: 'Monokai', swatch: {
    dark: ['#272822', '#F92672', '#F4BF75', '#A6E22E', '#66D9EF'],
    light: ['#FAFAF6', '#CE1F5E', '#8F7A00', '#5E8E01', '#0E87BE'],
  } },
  { id: 'everforest', name: 'Everforest', swatch: {
    dark: ['#2D353B', '#E67E80', '#DBBC7F', '#A7C080', '#7FBBB3'],
    light: ['#FDF6E3', '#F85552', '#DFA000', '#8DA101', '#3A94C5'],
  } },
  { id: 'rosepine', name: 'Rosé Pine', swatch: {
    dark: ['#191724', '#EB6F92', '#F6C177', '#9CCFD8', '#C4A7E7'],
    light: ['#FAF4ED', '#B4637A', '#EA9D34', '#56949F', '#907AA9'],
  } },
];
