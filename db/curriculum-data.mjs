// AUTO-EXTRACTED verbatim from the original academyProgress.html.
// Source of truth for the seeded "SDET Journey" learning path. Used only by db/seed.mjs.

export const CURRICULUM = [
  { id:'m0', num:'00', name:'Foundations & Mindset', topics:[
    {name:'Why Test Automation Matters', exercises:['Pick one manual flow your team runs every release. Time it. Multiply by # of releases per year.','Estimate the build cost of automating it. Compute payback period in releases.','Identify one flow that should NOT be automated yet (too volatile, low value, hard to stabilize) — explain why.']},
    {name:'The Automation Pyramid', exercises:['Count tests in your current project at each level. Sketch the actual shape.','Find one E2E test that asserts a business rule. Could it move to unit/integration? Try it.','Pick one bug from the last sprint. At which level should it have been caught?']},
    {name:'Types of Automation Testing', exercises:['Take 5 recent bugs in your tracker. Match each to the type of test that would have caught it earliest.','Identify one type your team isn\'t doing at all. Sketch the smallest first investment (one tool, one test).','Run an accessibility scan (axe-core or Lighthouse) on a page you own. Triage the top 3 findings.']},
    {name:'Non-Functional Testing', exercises:['Pick one critical endpoint. Write down its SLO (latency target, error budget, target RPS).','Run a 1-minute k6 test against it locally. Read the P95 line.','Run a Lighthouse audit on a page you own. Capture Performance, Accessibility, Best Practices, SEO scores.','Run an axe-core scan; file the top 3 a11y issues as tickets.']},
    {name:'API vs Front-end Automation', exercises:['Pick 5 E2E tests in your suite. Mark which ones could be replaced or shortened by API tests.','Convert one E2E business-rule check into an API test. Measure the speed difference.','Identify the smallest set of E2E tests that prove "the UI itself works" — that\'s your real E2E budget.']},
    {name:'Why E2E Automated Tests Matter', exercises:['List your product\'s "if this breaks we lose money or trust" flows. That\'s your E2E budget.','For each flow, write down what makes it flaky today, and one specific stabilisation you\'d apply.','Configure your E2E job to capture trace + screenshot on failure and upload as a CI artifact.']}
  ]},
  { id:'m1', num:'01', name:'Front-end Automation', topics:[
    {name:'Selenium vs Playwright vs Cypress', exercises:['Implement the same login test in two of the three. Time the run, count the lines.','Note what each one does automatically that the other doesn\'t.','Write a 1-paragraph rationale for which you\'d choose for your current product.']},
    {name:'Handling Web Elements', exercises:['On the-internet.herokuapp.com: automate a checkbox, a dropdown, a JS alert.','Find the same element via id, css, xpath, and getByRole — compare brittleness.','Extract a table\'s row count and assert it equals 4.']},
    {name:'Synchronization & Waits', exercises:['On the-internet.herokuapp.com/dynamic_loading: solve once with sleep, once with explicit wait. Run each 10x — count flakes.','Set a deliberately short timeout; read the failure message.','Find one Thread.sleep in your codebase; replace it with a wait and write a 1-line PR description.']},
    {name:'Exceptions & Debugging', exercises:['Trigger each of the three exceptions deliberately, then fix each one.','Add screenshot-on-failure to your runner config; verify a deliberate failure produces one.','In DevTools Console, validate one CSS and one XPath selector live.']},
    {name:'Assertions', exercises:['Add assertions for: title, URL, an element\'s text, an attribute.','Force each to fail; rewrite any vague messages.','Replace one if/else+log block with an explicit assertion.']},
    {name:'Page Object Model — Basics', exercises:['Refactor any 3-test suite into a Page Object.','Change a selector in the page object only; verify all 3 tests still pass.','Lift two reusable methods into a BasePage.']},
    {name:'Dynamic XPath Strategies', exercises:['On a real app, find an element with no stable id. Build an XPath anchored on its label.','Build an XPath that finds a button by row\'s text content (table cells).','Negotiate data-testid on the 3 most-tested components in your app.']},
    {name:'Chrome DevTools Protocol (CDP)', exercises:['Mock a single API response in a test; verify the UI renders the mocked state.','Throttle network to "Slow 3G" and run a critical flow; observe what breaks.','Capture all console errors during a test; fail if any appear.']},
    {name:'Advanced Waits & Retry Management', exercises:['Write a waitFor helper. Replace 3 ad-hoc polling loops with it.','Find a test that retries the whole flow on flake; move the retry to the actual unstable call.','Quarantine 1 known-flaky test in a separate suite; track it until fixed.']},
    {name:'Shadow DOM & iFrames', exercises:['Automate a Stripe Elements card form using frame locators.','Find a shadow-DOM component in your app; build a stable selector.','Dismiss a cookie banner that lives in a shadow root.']},
    {name:'Multi-Framework Exposure', exercises:['Port one Playwright test to Cypress (or vice versa). Note what each does naturally vs awkwardly.','Read each tool\'s "best practices" doc — make a 1-page cheat sheet of differences.','Write a 1-paragraph tool recommendation for a hypothetical greenfield project.']}
  ]},
  { id:'m2', num:'02', name:'Programming', topics:[
    {name:'OOP Basics', exercises:['Build a TestUser class with email, role, fullName().','Make all fields private; expose only what tests need.','Instantiate two users; pass them into a login test.']},
    {name:'Inheritance & Polymorphism', exercises:['Define a BasePage with open() and title(); subclass twice.','Override title() in each; assert per page.','Try the same with an interface — note where reuse breaks.']},
    {name:'Error Handling', exercises:['Wrap a flaky API call in a single retry; log the first failure.','Define a TestDataMissingException with a useful message.','Find one empty catch in a real codebase; fix it.']},
    {name:'Data Structures', exercises:['Build a TestDataProvider returning a list of 5 users.','Replace an if/else env-URL block with a Map lookup.','Use a Set to detect duplicates in generated emails.']},
    {name:'Working with Libraries & Packages', exercises:['Add and import 3 libraries; run them.','Read the lockfile — find one transitive dep you didn\'t install directly.','Bump a library by a major version. Read the changelog. Decide.']},
    {name:'Code Organization', exercises:['Reorganise a flat scripts/ folder into a proper layout.','Find a 60-line function; split into 3 helpers.','Delete every comment that just restates the code.']}
  ]},
  { id:'m3', num:'03', name:'API Automation', topics:[
    {name:'Bridge: Postman to Code', exercises:['Save a Postman request; convert via Code button. Run it.','Print only 3 specific fields from the response.','Add one dynamic header (e.g., a generated request ID).']},
    {name:'Writing Your First API Test', exercises:['Against reqres.in: GET asserting status + 1 field.','POST that creates and asserts non-null id.','Chain POST -> GET to prove the resource is retrievable.']},
    {name:'Making Tests Reusable', exercises:['Move base URL out of every test into a single config.','Build a request wrapper that auto-attaches auth.','Externalise one POST body to JSON; load it from the test.','Drive the same test from a 3-row CSV.']},
    {name:'Working Without a Backend (Mocks)', exercises:['Spin up a Postman mock for GET /users/{id} with 200 + 404 examples.','Write tests that pass against the mock for both cases.','Add a 500 example; verify your test surfaces it cleanly.']},
    {name:'Serialization / Deserialization', exercises:['Define a schema/POJO for a real endpoint; deserialise the response.','Break the schema deliberately; observe the failure message.','Test a nested array endpoint — assert against typed sub-fields.']},
    {name:'Data-Driven & Auth', exercises:['Drive a test from a 5-row JSON dataset.','Implement OAuth2 password-grant token retrieval; cache for the suite.','Write a role matrix (admin/user/guest x 3 endpoints) and assert correct codes.']},
    {name:'Non-Functional API Testing', exercises:['Pick one critical endpoint; write a k6 SLO test (P95 latency at target RPS).','Fire 50 concurrent POSTs to a "create unique resource" endpoint; assert no duplicates.','Add a perf job to CI that runs nightly, not per-commit.']},
    {name:'JSON Schema Validation', exercises:['Generate a JSON Schema from your OpenAPI spec (or write one for a small response).','Add schema validation to one existing test; deliberately break the response shape.','Compare schema validation to typed deserialisation — when do you want both?']},
    {name:'API Test Organisation', exercises:['Reorganise a flat api-tests/ folder by resource.','Build one client class for the most-used resource.','Tag 5 tests as @smoke; configure a CI job that runs only them on PR.']},
    {name:'CI/CD Pipeline Integration', exercises:['Add a smoke job that runs on every PR (< 2 min target).','Add a nightly full-regression job; set up notifications on failure.','Configure a status badge for the API suite in your README.']}
  ]},
  { id:'m4', num:'04', name:'SQL', topics:[
    {name:'DDL & Schema Understanding', exercises:['Spin up SQLite or use DB Fiddle. Create users + orders with FKs.','Add a column with ALTER; drop the column.','Read your project\'s schema; sketch the ERD on paper.']},
    {name:'All JOIN Types', exercises:['SQLZoo JOINs tutorial end-to-end.','Same query 3 ways: INNER, LEFT, RIGHT — compare row counts.','Find users with NO orders (LEFT JOIN + IS NULL).']},
    {name:'Complex WHERE Clauses', exercises:['Write a 3-condition query; rewrite with parentheses to flip meaning.','Replace an OR chain with IN.','Solve "products never ordered" using a subquery.']},
    {name:'Aggregate Functions & GROUP BY', exercises:['Compute total revenue per month.','List products ordered fewer than 3 times.','Find each customer\'s largest single order with MAX.']},
    {name:'Database Connectivity from Code', exercises:['Connect to local SQLite or Postgres from your test project.','Run SELECT; read 1 column.','Write a teardown that deletes the test rows you created.']},
    {name:'Parameterized Queries', exercises:['Convert one concatenated query to a prepared statement.','Try injecting \' OR 1=1 -- against both versions; observe.','Explain to a teammate why parameter binding stops the attack.']},
    {name:'Transaction Basics', exercises:['Wrap inserts in BEGIN/ROLLBACK; confirm rows don\'t persist.','Force a failure mid-flow; verify nothing committed.','Read up on isolation levels; identify your DB\'s default.']},
    {name:'Result Set Handling & Schema Navigation', exercises:['Query information_schema; list every table and FK.','Sketch the ERD on paper from the FK list.','Write a helper mapping a ResultSet row to a typed record.']},
    {name:'Indexes Awareness', exercises:['Run EXPLAIN on a query against a 100k-row table; note "seq scan" vs "index scan".','Add an index; re-run EXPLAIN; observe.','Insert 1k rows on the indexed table; note the (small) write cost.']},
    {name:'Window Functions', exercises:['Find each customer\'s most-recent order using ROW_NUMBER + PARTITION BY.','Use LAG to compute time between consecutive orders per user.','Compute a running total of daily revenue.']},
    {name:'Common Table Expressions (CTEs)', exercises:['Rewrite a nested subquery using a CTE; compare readability.','Write a recursive CTE for a category tree.','Chain 3 CTEs to express a multi-step transformation.']},
    {name:'Complex Subqueries', exercises:['Rewrite an IN(subquery) as EXISTS; compare EXPLAIN plans.','Find one correlated subquery; rewrite as a JOIN; compare.','Identify a case where IN and JOIN return different counts (duplicates).']},
    {name:'Database Testing', exercises:['Spin up a Postgres container in a test; run migrations against it.','Write a test asserting a NOT NULL constraint actually rejects NULLs.','Add a test that round-trips a stored procedure with sample input.']},
    {name:'NoSQL Awareness', exercises:['Run MongoDB locally (Docker). Insert and query a document.','Model a small domain twice — relational vs document. Compare query patterns.','Identify one place in your product where NoSQL would simplify, and one where it would hurt.']}
  ]},
  { id:'m5', num:'05', name:'Code Versioning (Git)', topics:[
    {name:'Version Control Fundamentals', exercises:['Clone any public repo, add a file, commit, push to a fork.','Inspect .git/; see commits as files in objects/.','Compare centralized vs distributed in a 1-paragraph note.']},
    {name:'Git Basics — Daily Commands', exercises:['Make 3 commits with messages that pass the "would I understand this in 6 months?" test.','Use git add -p to stage half a file\'s changes.','Run git log --graph on a multi-branch repo.']},
    {name:'Branching & Merging', exercises:['Create two branches that edit the same line. Merge, resolve, commit.','Try the same with rebase. Note when each is more readable.','Read 5 random merge commits in a real repo; rate the messages.']},
    {name:'Collaboration Basics — Pull Requests', exercises:['Fork a small open-source repo, fix a typo, open a PR.','Read 3 well-reviewed PRs in a real repo; note what made the discussion productive.','On your next PR, write the description before the code.']},
    {name:'Git Workflows — Gitflow vs Trunk-Based', exercises:['Identify which workflow your team uses; document it in 1 paragraph.','For one feature, sketch how it would flow through both workflows.','Set up a feature-flag library; gate a small change behind it.']},
    {name:'History Management — Revert, Reset, Reflog', exercises:['Revert a commit on a branch; observe the new "Revert ..." commit.','Use git reset --hard to discard local work, then recover with reflog.','Squash 4 WIP commits into 1 with interactive rebase.']},
    {name:'PR & Code Review Mastery', exercises:['Take your last PR; rewrite the description in a structured format.','Review one open PR in your repo with the lens "what\'s the smallest blocker?".','Resolve a merge conflict on a branch end-to-end without using the GitHub UI.']},
    {name:'Tagging & Releases', exercises:['Tag a commit; push the tag; verify it appears on GitHub.','Create a GitHub Release with auto-generated notes.','Add a CI step that tags on merge to main using a SemVer tool.']}
  ]},
  { id:'m6', num:'06', name:'CI / CD', topics:[
    {name:'Core Concepts — CI vs CD', exercises:['Read a real CI YAML in your repo. Identify trigger, jobs, steps, caches.','Explain CI vs CD vs continuous deployment to a non-technical friend in 60 seconds.','Sketch which stage each test type lives in (unit/integration/e2e).']},
    {name:'Working with Pipelines', exercises:['Trigger a workflow manually with an input. Read the output.','Find one failed run; classify: runner / build / test failure.','Add a step that runs only on PR.']},
    {name:'Running Tests in CI', exercises:['Add a secret; reference it; print only its length to logs (never the value).','Configure a JUnit-format report; upload as artifact; download and open it.','Add a deliberately-failing test; verify the build goes red and the report shows the failure.']}
  ]},
  { id:'m7', num:'07', name:'Mobile Automation', topics:[
    {name:'Environment Setup — Appium, ADB, Emulators', exercises:['Install Appium 2 + Android Studio. Boot an emulator. Run adb devices.','Launch a sample app on the emulator via Appium with capabilities.','Use adb logcat to find the package name of an installed app.']},
    {name:'Locators & Gestures', exercises:['Open Appium Inspector against a running app; identify 3 elements by accessibility-id.','Automate a tap, a long-press, and a swipe.','Negotiate stable accessibility-ids with your dev team for the 5 most-tested screens.']},
    {name:'Mobile-Specific Scenarios', exercises:['Toggle airplane mode mid-test; assert the offline state shows.','Switch to webview in a hybrid screen; click an element inside it.','Trigger an interrupt (incoming SMS via emulator command); verify the app recovers.']},
    {name:'Page Object Model for Mobile', exercises:['Refactor a flat mobile test into a Screen Object.','Add a platform branch for one element that differs between iOS and Android.','Build a scrollUntilVisible(label) helper in BaseScreen.']},
    {name:'Screenshot & Diagnostics on Failure', exercises:['Add screenshot + page source + logcat capture on failure.','Configure video recording for one suite run.','Trigger a deliberate failure; verify all artifacts upload to CI.']}
  ]},
  { id:'m8', num:'08', name:'Design Patterns', topics:[
    {name:'Page Object Model — Established Framework', exercises:['Refactor 3 page objects to return the next page object on success actions.','Extract a NavBar component object and reuse it across pages.','Move shared waits to BasePage; delete duplicates.']},
    {name:'Screenplay Pattern', exercises:['Read one Screenplay test aloud — verify it reads as English prose.','Convert one POM-based test into Screenplay; compare lines & readability.','Write a custom Task for "complete checkout".']},
    {name:'Singleton', exercises:['Implement a thread-local driver holder; run 4 tests in parallel; verify isolation.','Build a Config singleton that loads config.<env>.json once.','Identify one singleton in an existing project that should be a fixture instead.']},
    {name:'Page Factory', exercises:['Convert a manual Selenium-Java POM to use Page Factory annotations.','Trigger a stale element scenario; observe and fix.','Compare line count vs the manual approach; decide which you prefer.']}
  ]},
  { id:'m9', num:'09', name:'Testing Approaches & Frameworks', topics:[
    {name:'BDD — Behaviour-Driven Development', exercises:['Write 3 scenarios for a feature you own — read them with a non-engineer; iterate.','Implement step definitions for one scenario.','Decide for one team: is BDD paying for its overhead? Document the answer.']},
    {name:'TDD — Test-Driven Development', exercises:['Pick a small utility function. Write it TDD-style — test, code, refactor.','Next bug you fix: write the failing test reproducing it before you fix.','Try one Kata (e.g., Roman Numerals, FizzBuzz) entirely TDD.']},
    {name:'JVM Test Frameworks — TestNG & JUnit', exercises:['Set up JUnit 5 in a Maven project; run a parametrised test from @CsvSource.','Configure parallel execution; verify thread isolation.','Write a custom JUnit 5 Extension that takes a screenshot on failure.']},
    {name:'Other Frameworks — NUnit, MSTest, Mocha, Jest, pytest', exercises:['Pick the framework matching your project\'s language. Set up a parametrised test.','Configure parallel/sharded execution.','Add one fixture or hook that captures a screenshot on failure.']},
    {name:'Cucumber / SpecFlow — BDD Frameworks', exercises:['Set up Cucumber + Playwright (or SpecFlow + Selenium for .NET); run one scenario.','Reuse a step definition across two scenarios; verify ambiguity warnings if regex collides.','Generate an HTML/Allure report; share with a non-engineer for feedback.']}
  ]},
  { id:'m10', num:'10', name:'AI for Developers', topics:[
    {name:'What is AI — ML, Deep Learning, LLMs', exercises:['Define ML / DL / LLM in your own words.','Ask an LLM to write a test for a real page you control. Run it. Note what it got wrong.','Identify one task where AI saved you 20+ minutes this week.']},
    {name:'AI Coding Assistants — Copilot, Cursor, Claude Code', exercises:['Install Copilot in VS Code. Use it for an hour on real test code. Note one save and one mistake.','Try the chat panel; give it a 50-line file and ask it to refactor.','Compare the same prompt across two tools; observe which needed less correction.']},
    {name:'AI Safety — Reviewing AI-Generated Code', exercises:['Ask an AI for a "secure" auth helper. Audit it against the OWASP cheat sheet.','Find one hallucinated API call in your AI history. Save the example.','Run a license scanner on a small AI-assisted project.']},
    {name:'Advanced AI Tools', exercises:['Use Cursor Composer or Claude Code for one multi-file refactor. Read every diff before accepting.','Use Copilot\'s chat with @workspace context to ask about an unfamiliar repo.','Set up a CLAUDE.md / .cursorrules with your project\'s conventions; verify the agent respects them.']},
    {name:'AI for Test Automation', exercises:['Generate a page object for one screen with AI. Audit every locator.','Generate test data (50 plausible users) as JSON; spot-check for duplicates.','Convert a 10-test suite from manual waits to auto-retrying matchers via AI; review every diff.']},
    {name:'AI-Assisted Debugging — Errors & Logs', exercises:['Take a recent flaky failure. Paste error + code into AI; rank the hypotheses against your own.','Paste a 100-line failing log; ask AI to identify the first interesting line.','For one bug, document the 3 wrong hypotheses AI suggested before the right one.']}
  ]},
  { id:'m11', num:'11', name:'Prompt Engineering', topics:[
    {name:'Writing Prompts for Code', exercises:['Take a vague prompt you wrote and rewrite it with the 4 elements (role, context, task, format).','Run both versions; diff the outputs.','Save the best 3 prompts you write this week as templates.']},
    {name:'Basic Patterns — Write / Explain / Fix', exercises:['Use each pattern once today on real test code.','Take a recent bug; ask AI to explain the root cause from the diff. Compare to your own analysis.','Build 1-line shortcut prompts: /refactor, /explain, /test-this.']},
    {name:'Learning from AI Suggestions', exercises:['Pick one AI suggestion you accepted last week. Find the docs for every API it used.','Replace one AI suggestion with a simpler one you wrote yourself. Compare readability.','Keep a notebook: 1 line per useful pattern AI taught you each week.']},
    {name:'Code Generation Prompts — Framework-Specific', exercises:['Build a "framework prompt" template for your stack (1 paragraph) — reuse it everywhere.','Refactor 3 tests with the template; compare diffs to your manual fixes.','Generate a new test from a 1-sentence description that includes the framework prompt.']},
    {name:'Prompt Techniques — Few-Shot & Chain of Thought', exercises:['Pick a tricky transformation in your codebase. Write a 3-shot prompt; verify accuracy.','Use "list 3 hypotheses, then recommend one" on a real bug.','Compare zero-shot vs few-shot output for the same task; note quality difference.']},
    {name:'SDET-Specific Patterns', exercises:['Build a 5-prompt library covering: framework setup, API tests from OpenAPI, POM scaffolding, CI YAML, test data.','Run each on a fresh dummy project; refine until output requires no edits.','Share your library with one teammate; iterate based on feedback.']}
  ]},
  { id:'m12', num:'12', name:'Context Engineering', topics:[
    {name:'Code Context Fundamentals — What the AI Needs', exercises:['Write a prompt for a real change with no context. Save the output.','Write the same prompt with 3 files of context. Diff the quality.','Identify the minimum file set the AI needed (often 2-3 files).']},
    {name:'Providing Code Context — Files, Architecture, Rules', exercises:['Write a 1-page rules file for your project. Test it with 3 prompts.','Reference 2 files in a prompt explicitly; compare to a no-context run.','Add a 3-bullet "architecture" header to your standard prompt template.']},
    {name:'Repository-Aware Prompting — Project Structure & Patterns', exercises:['Write a 1-page ARCHITECTURE.md for your repo. Test by asking an AI to describe the project back.','Find one inconsistent folder/naming pattern; fix it.','Use @workspace or codebase indexing on a real change; observe what context the agent picked.']},
    {name:'Multi-File Context — Related Files & Test/Code Pairs', exercises:['Pick a small change touching 3 files. Write one prompt that updates all three; verify the diffs.','Find one PR you wrote where the AI missed a caller — write the prompt that would have caught it.','Build a "test/page/fixture trio" prompt template and reuse for next 3 features.']},
    {name:'Documentation as Context — Specs & Requirements', exercises:['Generate API tests from your team\'s OpenAPI spec; review what the AI got right and wrong.','Where the spec was wrong, file a docs ticket — that\'s value the AI surfaced.','Pair a feature file with a prompt to generate step definitions; review for accuracy.']}
  ]}
];

export const MODULE_COLORS = [
  '#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626',
  '#7c3aed','#0284c7','#16a34a','#9333ea','#0f766e','#b45309','#1d4ed8'
];

export const MODULE_ICONS = ['🚀','🖥️','💻','🔗','🗃️','🔀','⚙️','📱','🏗️','🧪','🤖','✍️','📐'];

export const DELIVERABLES = [
  {modId:'m0', title:'Automation Strategy Memo', desc:'1-page Automation Strategy memo: pyramid shape, test types, non-functional risks, what NOT to automate'},
  {modId:'m1', title:'Playwright POM Suite', desc:'5-test Playwright POM suite against SauceDemo, auto-waits, screenshots + trace on failure'},
  {modId:'m2', title:'Code Challenge', desc:'Solve a code challenge (e.g., anagram detector, palindrome, valid parentheses) — clean OOP, classes/methods, error handling, no copy-paste from AI'},
  {modId:'m3', title:'API Test Suite', desc:'API suite: 5+ tests, OAuth token retrieval, schema validation, parametrised from CSV/JSON'},
  {modId:'m4', title:'SQL Query File', desc:'10+ SQL queries on a seeded sample DB covering JOINs, GROUP BY/HAVING, subqueries, window functions, one CTE — runnable .sql file'},
  {modId:'m5', title:'Clean PR', desc:'One clean PR in a sandbox repo: feature branch, conventional commits, one rebase, one resolved merge conflict, one squashed history'},
  {modId:'m6', title:'CI/CD Pipeline', desc:'GitHub Actions workflow running tests on PR, secrets via env vars, HTML report uploaded as artifact, build fails on test failure'},
  {modId:'m7', title:'Mobile Test', desc:'Appium test on Android emulator: 3 scenarios, screen objects, screenshot + page-source on failure'},
  {modId:'m8', title:'POM Refactor', desc:'Refactor a flat test suite into layered POM (BasePage + chained page objects + one component object); diff committed'},
  {modId:'m9', title:'TDD or BDD Feature', desc:'Either (a) TDD\'d utility lib with red→green→refactor commits, OR (b) Cucumber feature with 3 scenarios + step definitions'},
  {modId:'m10', title:'AI-Assisted Edits Doc', desc:'Doc with 10 AI-assisted edits logged: prompt → AI output → final edit → why you changed it'},
  {modId:'m11', title:'Prompt Library', desc:'Personal prompt library: ≥5 reusable templates (framework setup, test gen, CI YAML, debug, refactor) committed to a repo'},
];
