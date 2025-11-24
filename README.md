# Module 2 Group Assignment

CSCI 5117, Fall 2025, [assignment description](https://canvas.umn.edu/courses/518559/pages/project-2)

## App Info:

* Team Name: http-200
* App Name: PhDHub
* App Link: <https://TODO.com/>

### Students
* Leon Chen, chen9861@umn.edu
* Chunlin Gong, gong0226@umn.edu


## Key Features

**Describe the most challenging features you implemented
(one sentence per bullet, maximum 4 bullets):**

* ...

Which (if any) device integration(s) does your app support?

* ...

Which (if any) progressive web app feature(s) does your app support?

* ...



## Mockup images

**[Add images/photos that show your mockup](https://stackoverflow.com/questions/10189356/how-to-add-screenshot-to-readmes-in-github-repository) along with a very brief caption:**

### Overall Design Mockup
<img src="Mock-ups/Mockup.png" alt="Overall Mockup" width="800"/>
*Complete PhD application management system design overview, integrating all application components and information aggregation features*



### Splash Page

<img src="Mock-ups/Log.png" alt="Log" width="800"/>
*Application timeline and activity log tracking all PhD application progress, deadlines, submissions, and important milestones*

Added a simple splash / landing screen before Login/Setup

-  Gives users a clearer starting point
-  Makes the flow feel more intentional



### Home Page

<img src="Mock-ups/HomePage.png" alt="Home Page" width="800"/>
*Dashboard showing application overview, pending tasks, and quick access to all PhD application management features*

-  Cleaned up the layout so it feels more organized
-  Replaced the old left-side column with a footer navigation bar
   -  Helps users understand how to move between pages
-  Added small labels so the purpose of each button is clearer



### Program Information

<img src="Mock-ups/Program_info.png" alt="Program Info" width="800"/>
*PhD program information aggregator displaying detailed program requirements, deadlines, faculty research areas, and application checklist*

- Broke the page into a clear three-step workflow

  -  Choose school (with auto-suggestion)
  -  Choose professor (with fallback if not in database)
  -  Add TODO list

- Redesigned the TODO list so it actually looks like a list of tasks

- Added clear form fields for adding new TODO items

- Added explanations for task frequency and reminder logic

  

### Statement of Purpose (SOP)
<img src="Mock-ups/SOP.png" alt="SOP" width="800"/>
*SOP management interface for creating, editing, and organizing multiple versions of personal statements for different PhD programs*

- Added labels showing how users select, edit, and compare SOP drafts

- Clarified what each SOP block represents (draft, version, or reference)

- Improved the editor area so the interaction is easier to understand



### Recommendation Letter

<img src="Mock-ups/Recommendation Letter.png" alt="Recommendation Letter" width="800"/>
*Recommendation letter tracker for managing requests, tracking submission status, and organizing letters by program and recommender*



### AI Assisted Features

<img src="Mock-ups/AI Assisted.png" alt="AI Assisted" width="800"/>
*AI-powered writing assistant for generating, refining, and optimizing SOP drafts, recommendation letter requests, and other application materials*

Left the structure as-is since this part was already clear



# Revised Mockup Feedback Response (QA Format)

**Q1:** Why does the site go straight to the login/setup page with no splash page?  
**A1:** We've already added a splash page before login, so that issue has been resolved.

***

**Q2:** The home page layout feels scattered, the left column is unclear, and the two-column design will break on mobile. How will this be addressed?  
**A2:** Our original left-hand column represented various functions. To prevent display issues on mobile devices, we plan to move all function modules to the bottom, so this has been resolved according to your requirements.

***

**Q3:** The Statement of Purpose (SOP) section is completely unclear — how is the user supposed to interact with it?  
**A3:** Users can select SOPs they want to see using filters, and then the right side is an editing block that su

***

**Q4:** On the program detail page, what happens if the professor doesn’t exist in the database? Is there a fallback plan?  
**A4:** Our professor information comes entirely from thousands of professors provided by CSranking. This open-source dataset is maintained by many people and is updated almost monthly. New professors are usually included in the statistics. If a professor is not listed, we will manually add them, but this issue rarely occurs, and users can choose other professors.

***

**Q5:** The TODO list currently looks like plain text blocks with no indication it’s interactive. How do users add, edit, or complete tasks?  
**A5:** We've now modified the format of the Todo List block, so users can easily edit it by clicking on it.

***

**Q6:** In the recommendation letter section, after entering a professor’s email, does the system automatically send a request, or is it just manual tracking? The flow is unclear.  

**A6:** The system will automatically send email reminders to professors. Once professors have filled out the form, they can directly use this system to inform applicants that they have completed the form, instead of repeatedly sending emails to applicants. Applicants can clearly see which schools the professor has filled out and which schools are still missing.


## Testing Notes

**Is there anything special we need to know in order to effectively test your app? (optional):**

* ...



## Screenshots of Site (complete)

**[Add a screenshot of each key page](https://stackoverflow.com/questions/10189356/how-to-add-screenshot-to-readmes-in-github-repository)
along with a very brief caption:**

![](https://media.giphy.com/media/o0vwzuFwCGAFO/giphy.gif)



## External Dependencies

**Document integrations with 3rd Party code or services here.
Please do not document required libraries (e.g., VUE, Firebase, vuefire).**

* Library or service name: description of use
* ...

**If there's anything else you would like to disclose about how your project
relied on external code, expertise, or anything else, please disclose that
here:**

...
