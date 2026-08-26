export type ReleaseNoteSection = {
  title: string
  items: string[]
}

export type ReleaseNote = {
  version: string
  codename: string
  status?: string
  releasedOn: string
  comparison: string
  summary: string
  sections: ReleaseNoteSection[]
}

export const releases: ReleaseNote[] = [
  {
    version: 'v0.1.0-beta.3',
    codename: 'Misty Delta',
    status: 'Current beta',
    releasedOn: '26 Aug 2026',
    comparison: 'What changed since beta.2',
    summary:
      'Misty Delta turns the Research Dashboard from a single-user workspace into a controlled collaborative environment, while also improving Hours, Planning, paper workspaces and personal account management.',
    sections: [
      {
        title: 'Collaboration and access',
        items: [
          'Added Viewer access for people who need to consult the dashboard without changing its data.',
          'Added paper-specific Coauthor access so collaborators can work only on the papers assigned to them.',
          'Viewer and Coauthor access can be combined: a collaborator can read the wider dashboard while editing only their assigned papers.',
          'Added an Owner-only Access area for managing accounts, Viewer access and Coauthor paper assignments.',
          'Added invitation and onboarding flows so new collaborators can create their account from an email invitation.',
          'Added an Owner-visible access history covering invitations, Viewer permissions, Coauthor assignments and managed-account changes.',
        ],
      },
      {
        title: 'Personal accounts and security',
        items: [
          'Added a personal Account page where every signed-in user can update their display name, email address and password.',
          'Added password recovery from the sign-in page.',
          'Standardised new and changed passwords on a minimum of 10 characters.',
          'Email changes use confirmation before the new address becomes the sign-in identity.',
          'Improved account deletion so unused profiles are removed, while profiles needed for historical attribution are preserved.',
          'Cancelled invitations now remove unused onboarding accounts automatically when one was already created.',
        ],
      },
      {
        title: 'Paper collaboration',
        items: [
          'Coauthors can update collaborative research content such as the full title, authors, abstract, venues, research links, milestones, presentations and notes.',
          'Owner-controlled workflow fields such as status, revision round, dates, history, citations and archive state remain protected.',
          'Archived papers remain visible to assigned Coauthors for reference but become read-only until restored.',
          'Notes retain their original author, and coauthors can change only notes they created themselves.',
          'Added an Author Directory for maintaining the canonical bibliographic names used across papers.',
          'Added safe Markdown and LaTeX-style rendering for research text and notes.',
        ],
      },
      {
        title: 'Hours and Planning',
        items: [
          'Added managed location labels and a default location for new work sessions.',
          'Improved the Hours layout and kept recorded coffee information visible in read-only mode.',
          'Refined Planning terminology and presentation, including FlowSavvy/Calendar wording and a clearer period-load view.',
          'Added shortcuts to standby papers and made existing planning allocations easier to move between periods.',
        ],
      },
      {
        title: 'Reliability and usability',
        items: [
          'Improved read-only behaviour so Viewer accounts cannot briefly see or use editing controls while a page loads.',
          'Kept navigation, search, date selection and filtering available even when editing is disabled.',
          'Separated personal account settings from Owner administration so users can manage their own credentials without receiving wider editing rights.',
          'Corrected Hours system-label handling so collaborator accounts no longer receive Owner-only Break labels.',
          'Removed unnecessary direct-table privileges and added active-account checks beneath the application interface.',
        ],
      },
    ],
  },
  {
    version: 'v0.1.0-beta.2',
    codename: 'Ember Orchard',
    releasedOn: '24 Aug 2026',
    comparison: 'What changed since beta.1',
    summary:
      'Ember Orchard focused on making working-time analytics more consistent and useful across Hours, Planning and the main Dashboard.',
    sections: [
      {
        title: 'Hours and workload',
        items: [
          'Unified day, week, month and year working-time calculations so the same definitions are used throughout the application.',
          'Improved the Hours page layout by placing the selected day and daily log together.',
          'Added weekly workload indicators to help identify unusually light or heavy working weeks.',
          'Added a weekly coffee signal based on recorded daily coffee counts.',
        ],
      },
      {
        title: 'Dashboard and Planning',
        items: [
          'Changed planning indicators from committed days to planned hours, using one planned working day as eight hours.',
          'Added direct links from Planning allocations to their associated paper workspaces.',
          'Reused the same Hours calculations for Dashboard workload summaries, reducing differences between modules.',
        ],
      },
      {
        title: 'Navigation and development',
        items: [
          'Changed the signed-in identity shown in the interface from the email address to the user’s full name.',
          'Added local project configuration to make database development and future migrations more reproducible.',
        ],
      },
    ],
  },
  {
    version: 'v0.1.0-beta.1',
    codename: 'Ember Willow',
    releasedOn: '22 Aug 2026',
    comparison: 'First beta release',
    summary:
      'Ember Willow established the first production-ready version of the Research Dashboard and brought Papers, Hours, Planning and the executive Dashboard into one authenticated workspace.',
    sections: [
      {
        title: 'Papers',
        items: [
          'Added paper workspaces with workflow status, milestones, submission and revision history, presentations, notes, links, citations and archiving.',
          'Connected papers with recorded working hours so research time can be analysed alongside project progress.',
        ],
      },
      {
        title: 'Hours',
        items: [
          'Added daily logs with manual work sessions, activity labels, breaks, locations, coffee counts and optional paper links.',
          'Added daily, weekly, monthly and annual summaries, including a GitHub-style yearly activity heatmap.',
        ],
      },
      {
        title: 'Planning',
        items: [
          'Added biweekly planning periods for the first and second half of each month.',
          'Added 5-, 10-, and 15-day paper commitments plus blocked time for teaching, conferences, holidays and administrative work.',
          'Added monthly and annual planning views and planned-versus-actual research comparisons.',
        ],
      },
      {
        title: 'Dashboard and production',
        items: [
          'Added executive indicators for active papers, workload, planning and research priorities.',
          'Added cross-module analytics and citation-yield summaries for papers with recorded hours.',
          'Added authenticated access, database security rules and production deployment on the custom dashboard domain.',
        ],
      },
    ],
  },
]

export const currentRelease = releases[0]
