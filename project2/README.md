# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Technology Stack & References

### Core Framework
1. [Vue 3](https://vuejs.org/) - Progressive JavaScript framework
   - [Vue Composition API](https://vuejs.org/api/composition-api-setup.html) - Used for component logic
   - [Vue Component Events](https://vuejs.org/guide/components/events.html) - Component communication
   - [Vue Props](https://vuejs.org/guide/components/props.html) - Component props
   - [Vue Conditional Rendering](https://vuejs.org/guide/essentials/conditional.html) - Used `v-if` and `v-else` for modal display and expanded card states

2. [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript
   - [TypeScript Documentation](https://www.typescriptlang.org/docs/)

3. [Vite](https://vitejs.dev/) - Next generation frontend tooling
   - [Vite Guide](https://vitejs.dev/guide/)

### Routing & State Management
4. [Vue Router](https://router.vuejs.org/) - Official router for Vue.js
   - [Vue Router Guide](https://router.vuejs.org/guide/) - Used for navigation between login, home, SOP, and other views

5. [Pinia](https://pinia.vuejs.org/) - The Vue Store that you will enjoy using
   - [Pinia Core Concepts](https://pinia.vuejs.org/core-concepts/) - Used for managing auth, projects, SOP, and application state

### UI Framework & Styling
6. [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
   - [Tailwind CSS Documentation](https://tailwindcss.com/docs)

7. [PostCSS](https://postcss.org/) - CSS tool for transforming styles
   - [PostCSS Documentation](https://postcss.org/docs/)

8. [Radix Vue](https://www.radix-vue.com/) - Unstyled, accessible components for Vue
   - [Radix Vue Documentation](https://www.radix-vue.com/getting-started/introduction)
   - Used as the foundation for shadcn-vue components

9. [shadcn-vue](https://www.shadcn-vue.com/) - Re-usable components built with Radix Vue and Tailwind CSS
   - Components used: Button, Card, Dialog, Input, Select, Badge, Tooltip, Separator

### UI Utilities
10. [clsx](https://github.com/lukeed/clsx) - Tiny utility for constructing className strings
11. [tailwind-merge](https://github.com/dcastil/tailwind-merge) - Merge Tailwind CSS classes without style conflicts
12. [class-variance-authority](https://cva.style/) - Create type-safe variant APIs for your components

### Backend & Database
13. [Firebase](https://firebase.google.com/) - Backend-as-a-Service platform
   - [Firebase Documentation](https://firebase.google.com/docs)
   - [Firebase Firestore](https://firebase.google.com/docs/firestore) - Used for data storage
   - [Firebase Authentication](https://firebase.google.com/docs/auth) - Used for user authentication
   - [Firebase Cloud Functions](https://firebase.google.com/docs/functions) - Used for email sending functionality

### Third-Party Services & Libraries
14. [OpenAI API](https://platform.openai.com/docs) - AI service for intelligent search functionality
   - [OpenAI Node.js SDK](https://github.com/openai/openai-node)

15. [PDF.js](https://mozilla.github.io/pdf.js/) - PDF rendering library
   - [PDF.js Documentation](https://mozilla.github.io/pdf.js/getting_started/)
   - Used for displaying SOP PDFs in the application

16. [md-editor-v3](https://imzbf.github.io/md-editor-v3/) - Markdown editor component for Vue 3
   - [md-editor-v3 Documentation](https://imzbf.github.io/md-editor-v3/docs)

## Data Sources

This project uses the following open-source data:

1. **[CSRankings](https://github.com/emeryberger/CSRankings)** - Computer Science Rankings
   - Professor and institution data source for real-world academic information
   - Website: [csrankings.org](http://csrankings.org/)
   - Used for professor and university data in the application

2. **[CS PhD Statements of Purpose](https://cs-sop.notion.site/CS-PhD-Statements-of-Purpose-df39955313834889b7ac5411c37b958d)** - Collection of PhD application statements
   - Used as reference data for SOP examples and templates
   - Provides examples of successful PhD application statements

## Project Structure

- `src/components/` - Vue components
- `src/views/` - Page-level components
- `src/stores/` - Pinia stores for state management
- `src/services/` - Service layer for API calls and external integrations
- `src/utils/` - Utility functions and helpers
- `src/router/` - Vue Router configuration
- `src/firebase/` - Firebase configuration
- `public/Data/` - Static data files (CSV, etc.)

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```
