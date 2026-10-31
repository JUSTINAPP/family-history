# Design system

An Archive should feel like a contemporary gallery archive and an independent art book with personal material. Historical sources supply texture; the interface supplies clarity. No fake tape, handwriting fonts, torn-paper effects, Polaroid frames, ageing, sepia filters or generative historical imagery.

Tokens in `src/app/globals.css`: paper #f5f3ed; charcoal #262823; secondary text #686b61; rule #d7d6cb; restrained olive #5f684e. Large editorial moments use self-hosted Libre Caslon Display. Navigation, captions, controls and metadata use self-hosted DM Sans. Font licences are alongside the assets. No runtime font network request is needed.

Use generous gutters (22px mobile to 88px large desktop), thin rules, asymmetric imagery, fine numbered captions and occasional charcoal sections. The home collage overlaps full source images; letter viewing preserves the complete sheet. Cards are material and caption without dashboard chrome. Category rows make strong scale shifts. Controls use square, restrained borders. Circular portraits are limited to the small relationship view.

Responsive composition: desktop uses split hero/collage, four-column archive and two-column source/metadata; tablet uses two/three columns and stacks the item; phone uses a full editorial hero followed by its collage, two-column browse and stacked capture fields. Bulk review is designed for desktop, with a usable single-column fallback. Header navigation collapses to an explicit menu. Avoid horizontal overflow, fixed-width source content and sideways scrolling controls.

Accessibility: one h1 per page, labelled inputs, explicit expanded/pressed/selected states, meaningful source alt text, skip link, visible keyboard focus, native file inputs and dialog with Escape dismissal. Reduced motion disables transforms/animations. Status changes use live regions. Targets are spaced and primary actions are at least 44px tall. Transcription and original are separately labelled; AI sample status never relies on colour alone. See validation.md for actual automated results and limits.

Demo images represent layout, not verified identity. Keep replaceable fixture metadata in `src/lib/data.ts` and asset provenance in assets.md. Real family material will arrive through authenticated private storage; never commit it in public assets.

## Capture and administration extension

Retain the original home/discovery layout. Capture uses the same paper, olive and charcoal, with a larger source preview, a quieter single task, full-width phone recording controls and optional details. Recording status is explicit text plus icon/time; pause/finish/re-record/play remain clear. The demo microphone state is always explained. Rapid capture minimises repeated decisions.

Admin uses serif titles, thin rules, editorial lists and generous spacing rather than dashboard cards or dense SaaS tables. Member identity, role, linked Person and status remain separate fields. Administration is a left rail on desktop and a compact wrapping navigation on phones. Native dialogs supply focus containment/Escape for member/invitation editing. Role descriptions are presented alongside the choices. Suggested/uncertain/contributor-confirmed interpretations use distinct wording, not colour alone.

## Current archive identity

Use Archive as the product concept. The initial content belongs to The Allen & Cork Archive. Its name appears in the header’s compact disclosure/switcher and relevant admin context; avoid repeating it as branding on every page. A single-archive account shows one current entry and its membership role, with no visually dominant archive-selection screen. The typography, paper, navigation rhythm and editorial browsing remain unchanged. Names of other kinds of archive must fit responsively without a family-specific wordmark or required prefix.
