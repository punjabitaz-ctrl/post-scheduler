<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div v-if="booting" class="flex min-h-[70vh] items-center justify-center">
        <div
          class="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm"
        >
          Loading post scheduler...
        </div>
      </div>

      <div v-else-if="!isAuthenticated" class="mx-auto max-w-6xl">
        <div
          class="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,420px)]"
        >
          <section
            class="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <p
              class="text-sm font-medium tracking-[0.3em] text-sky-600 uppercase"
            >
              Simple scheduled social media posting
            </p>
            <h1
              class="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl"
            >
              Monthly social posting from one clean calendar
            </h1>
            <p class="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Sign in, connect your channels, click a day on the calendar, and
              schedule posts from the day drawer
            </p>

            <div class="mt-8 grid gap-4 sm:grid-cols-3">
              <div
                v-for="stat in HERO_STATS"
                :key="stat.label"
                class="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p class="text-xs tracking-[0.2em] text-slate-500 uppercase">
                  {{ stat.label }}
                </p>
                <p class="mt-2 text-lg font-medium text-slate-900">
                  {{ stat.value }}
                </p>
              </div>
            </div>
          </section>

          <section
            class="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div
              class="flex rounded-2xl border border-slate-200 bg-slate-100 p-1 text-sm"
            >
              <button
                v-for="mode in AUTH_MODE_OPTIONS"
                :key="mode.value"
                class="flex-1 rounded-xl px-4 py-2 font-medium transition"
                :class="segmentedButtonClasses(authMode === mode.value)"
                @click="authMode = mode.value"
              >
                {{ mode.label }}
              </button>
            </div>

            <form class="mt-6 space-y-4" @submit.prevent="submitAuth">
              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">Email</span>
                <input
                  v-model="authForm.email"
                  type="email"
                  autocomplete="email"
                  required
                  class="field-input ring-0"
                  placeholder="you@example.com"
                />
              </label>

              <label class="block space-y-2">
                <span class="text-sm font-medium text-slate-700">Password</span>
                <input
                  v-model="authForm.password"
                  type="password"
                  :autocomplete="
                    authMode === 'signin' ? 'current-password' : 'new-password'
                  "
                  required
                  minlength="8"
                  class="field-input ring-0"
                  placeholder="At least 8 characters"
                />
              </label>

              <button
                type="submit"
                class="btn-primary w-full"
                :disabled="loading"
              >
                {{
                  loading
                    ? "Please wait..."
                    : authMode === "signin"
                      ? "Sign In"
                      : "Create Account"
                }}
              </button>
            </form>
          </section>
        </div>
      </div>

      <div v-else-if="!user" class="mx-auto max-w-xl">
        <section
          class="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <p class="text-sm tracking-[0.25em] text-sky-600 uppercase">
            Session active
          </p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Loading your dashboard
          </h1>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            Your JWT is still active. If the dashboard does not load, try
            refreshing or signing out and back in.
          </p>

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              class="btn-secondary"
              :disabled="refreshing"
              @click="refreshData(true)"
            >
              {{ refreshing ? "Refreshing..." : "Refresh" }}
            </button>
            <button
              class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              @click="signOut"
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>

      <div v-else class="space-y-6">
        <section
          class="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div
            class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
          >
            <div>
              <p class="text-sm tracking-[0.25em] text-sky-600 uppercase">
                Dashboard
              </p>
              <h1
                class="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl"
              >
                Schedule posts with ease
              </h1>
              <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Click a date to open that day and schedule posts from the modal
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <a
                href="https://1e3pm.pages.dev/c/gh"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="GitHub"
              >
                <img
                  src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/github.svg"
                  alt=""
                  class="h-5 w-5"
                  aria-hidden="true"
                />
              </a>
              <a
                href="https://1e3pm.pages.dev/c"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Discord"
              >
                <img
                  src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/discord.svg"
                  alt=""
                  class="h-5 w-5"
                  aria-hidden="true"
                />
              </a>
              <button
                class="btn-secondary"
                :disabled="refreshing"
                @click="refreshData(true)"
              >
                {{ refreshing ? "Refreshing..." : "Refresh" }}
              </button>
              <div class="relative">
                <button
                  type="button"
                  class="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                  @click.stop="showUserMenu = !showUserMenu"
                >
                  <User :size="20" aria-hidden="true" />
                </button>
                <div
                  v-if="showUserMenu"
                  class="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                  @click.stop
                >
                  <div class="px-4 py-3">
                    <p class="truncate text-sm font-medium text-slate-900">
                      {{ user.email }}
                    </p>
                    <div
                      v-if="user.isAdmin"
                      class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
                    >
                      <Crown :size="14" aria-hidden="true" />
                      Super admin
                    </div>
                  </div>
                  <div class="border-t border-slate-200">
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      @click="
                        signOut();
                        showUserMenu = false;
                      "
                    >
                      <LogOut :size="20" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-2 rounded-3xl bg-slate-100 p-1">
            <button
              v-for="tab in DASHBOARD_TABS"
              :key="tab.value"
              class="rounded-2xl px-4 py-2 text-sm font-semibold transition"
              :class="segmentedButtonClasses(activeTab === tab.value)"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>
        </section>

        <div v-if="activeTab === 'calendar'">
          <section
            class="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 class="text-2xl font-semibold text-slate-900">
                  {{ currentMonth.format("MMMM YYYY") }}
                </h2>
                <p class="mt-1 text-sm text-slate-500">
                  Click a date to open that day
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button class="btn-secondary-sm" @click="previousMonth">
                  Prev
                </button>
                <button class="btn-secondary-sm" @click="goToCurrent">
                  Current
                </button>
                <button class="btn-secondary-sm" @click="nextMonth">
                  Next
                </button>
              </div>
            </div>

            <div
              class="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase"
            >
              <div v-for="weekday in WEEKDAY_LABELS" :key="weekday">
                {{ weekday }}
              </div>
            </div>

            <div class="mt-2 grid grid-cols-7 gap-2">
              <button
                v-for="day in calendarDays"
                :key="day.key"
                class="group flex aspect-square min-h-26.5 flex-col rounded-3xl border p-3 text-left transition md:min-h-33"
                :class="[
                  day.isCurrentMonth
                    ? 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40'
                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-slate-100',
                  day.isToday ? 'ring-2 ring-sky-300' : '',
                ]"
                @click="openDay(day.key)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                    :class="
                      day.isToday ? 'bg-sky-600 text-white' : 'text-slate-700'
                    "
                  >
                    {{ day.date.date() }}
                  </span>

                  <span
                    v-if="day.posts.length"
                    class="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700"
                  >
                    {{ day.posts.length }}
                  </span>
                </div>

                <div class="mt-3 space-y-1 overflow-hidden text-xs">
                  <div
                    v-for="post in day.posts.slice(0, 2)"
                    :key="post.id"
                    class="truncate rounded-xl bg-slate-100 px-2 py-1 text-slate-700"
                  >
                    {{ formatTime(post.scheduledPublishAt!) }}
                    {{ post.title || "Untitled post" }}
                  </div>
                  <div
                    v-if="day.posts.length > 2"
                    class="text-[11px] text-slate-500"
                  >
                    +{{ day.posts.length - 2 }} more
                  </div>
                </div>
              </button>
            </div>
          </section>
        </div>

        <div v-else-if="activeTab === 'providers'" class="space-y-6">
          <section
            class="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-xl font-semibold text-slate-900">Providers</h2>
                <p class="mt-1 text-sm text-slate-500">
                  Save provider credentials here, then connect them
                </p>
              </div>

              <button
                class="btn-primary"
                @click="showProviderForm = !showProviderForm"
              >
                Add provider
              </button>
            </div>

            <form
              v-if="showProviderForm"
              class="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
              @submit.prevent="createProvider"
            >
              <label class="block space-y-2">
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >Provider</span
                >
                <div ref="providerEl" class="relative">
                  <button
                    type="button"
                    class="field-select flex w-full items-center justify-between text-left"
                    @click="openProvider = !openProvider"
                  >
                    <span>{{ humanizeProviderType(providerForm.type) }}</span>
                    <ChevronDown
                      class="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform"
                      :class="{ 'rotate-180': openProvider }"
                    />
                  </button>
                  <div
                    v-if="openProvider"
                    class="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                  >
                    <div
                      v-for="type in OAUTH_PROVIDER_TYPES"
                      :key="type"
                      class="cursor-pointer px-4 py-3 text-sm transition hover:bg-slate-50"
                      :class="{
                        'bg-sky-50 font-semibold text-sky-600':
                          providerForm.type === type,
                      }"
                      @click.prevent="
                        providerForm.type = type;
                        openProvider = false;
                      "
                    >
                      {{ humanizeProviderType(type) }}
                    </div>
                  </div>
                </div>
              </label>

              <label class="block space-y-2">
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >Client ID</span
                >
                <input
                  v-model="providerForm.clientId"
                  type="text"
                  name="oauth-client-id"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  required
                  class="field-input-white"
                  placeholder="OAuth client ID"
                />
              </label>

              <label class="block space-y-2">
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >Client secret</span
                >
                <input
                  v-model="providerForm.clientSecret"
                  type="text"
                  name="oauth-client-secret"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  required
                  class="field-input-white"
                  placeholder="OAuth client secret"
                />
              </label>

              <label
                v-if="selectedProviderMeta.extraField"
                class="block space-y-2"
              >
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >{{ selectedProviderMeta.extraField.label }}</span
                >
                <input
                  v-model="providerForm.extra"
                  type="url"
                  required
                  class="field-input-white"
                  :placeholder="selectedProviderMeta.extraField.placeholder"
                />
              </label>

              <p
                v-if="selectedProviderMeta.extraField"
                class="text-sm leading-6 text-slate-500"
              >
                {{ selectedProviderMeta.extraField.help }}
              </p>

              <div
                class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
              >
                <div
                  class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div class="min-w-0">
                    <p class="font-medium">
                      Add this redirect URI to the provider app
                    </p>
                    <p class="mt-2 font-sans text-xs break-all text-sky-800">
                      {{ providerRedirectUri }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                    @click="
                      copyToClipboard(
                        providerRedirectUri,
                        'Redirect URI copied.',
                      )
                    "
                  >
                    Copy URI
                  </button>
                </div>
              </div>

              <label
                v-if="user.isAdmin"
                class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <input
                  v-model="providerForm.isGlobal"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 bg-white text-sky-600"
                />
                Save this as a global provider
              </label>

              <button
                type="submit"
                class="btn-primary w-full"
                :disabled="savingProvider"
              >
                {{ savingProvider ? "Saving..." : "Save Provider" }}
              </button>
            </form>

            <div
              v-if="sortedProviders.length === 0"
              class="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500"
            >
              No saved providers yet
            </div>

            <div v-else class="mt-4 space-y-3">
              <div
                v-for="provider in sortedProviders"
                :key="provider.id"
                class="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-sm font-semibold text-slate-900">
                        {{ humanizeProviderType(provider.type) }}
                      </p>
                      <span
                        v-if="provider.userId === null"
                        class="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        Global
                      </span>
                    </div>
                    <p class="mt-1 text-xs break-all text-slate-500">
                      {{ provider.clientId }}
                    </p>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <button
                      class="btn-primary-xs"
                      :disabled="connectingProviderId === provider.id"
                      @click="connectProvider(provider)"
                    >
                      {{
                        connectingProviderId === provider.id
                          ? "Connecting..."
                          : "Connect"
                      }}
                    </button>
                    <button
                      v-if="canDeleteProvider(provider)"
                      class="btn-secondary-xs"
                      :disabled="deletingProviderId === provider.id"
                      @click="deleteProvider(provider)"
                    >
                      {{
                        deletingProviderId === provider.id
                          ? "Deleting..."
                          : "Delete"
                      }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div v-else class="space-y-6">
          <section
            class="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-xl font-semibold text-slate-900">Channels</h2>
                <p class="mt-1 text-sm text-slate-500">
                  These are the destinations that appear in the calendar day
                  modal
                </p>
              </div>

              <button
                class="btn-primary"
                @click="showChannelForm = !showChannelForm"
              >
                Add channel
              </button>
            </div>

            <form
              v-if="showChannelForm"
              class="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
              @submit.prevent="createManualChannel"
            >
              <label class="block space-y-2">
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >Provider</span
                >
                <div ref="manualProviderEl" class="relative">
                  <button
                    type="button"
                    class="field-select flex w-full items-center justify-between text-left"
                    @click="openManualProvider = !openManualProvider"
                  >
                    <span>{{
                      humanizeProviderType(manualChannelForm.providerType)
                    }}</span>
                    <ChevronDown
                      class="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform"
                      :class="{ 'rotate-180': openManualProvider }"
                    />
                  </button>
                  <div
                    v-if="openManualProvider"
                    class="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                  >
                    <div
                      v-for="type in MANUAL_PROVIDER_TYPES"
                      :key="type"
                      class="cursor-pointer px-4 py-3 text-sm transition hover:bg-slate-50"
                      :class="{
                        'bg-sky-50 font-semibold text-sky-600':
                          manualChannelForm.providerType === type,
                      }"
                      @click.prevent="
                        manualChannelForm.providerType = type;
                        openManualProvider = false;
                      "
                    >
                      {{ humanizeProviderType(type) }}
                    </div>
                  </div>
                </div>
              </label>

              <label class="block space-y-2">
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >{{ selectedManualProviderMeta.credentialLabel }}</span
                >
                <input
                  v-model="manualChannelForm.accessToken"
                  type="text"
                  required
                  class="field-input-white"
                  :placeholder="
                    manualChannelForm.providerType === 'bluesky'
                      ? 'Email'
                      : selectedManualProviderMeta.credentialLabel
                  "
                />
              </label>

              <label
                v-if="manualChannelForm.providerType === 'bluesky'"
                class="block space-y-2"
              >
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >App password</span
                >
                <input
                  v-model="manualChannelForm.password"
                  type="text"
                  required
                  class="field-input-white"
                  placeholder="App password"
                />
              </label>

              <p class="text-sm leading-6 text-slate-500">
                {{ selectedManualProviderMeta.credentialHelp }}
              </p>

              <button
                type="submit"
                class="btn-primary w-full"
                :disabled="savingManualChannel"
              >
                {{
                  savingManualChannel
                    ? "Connecting..."
                    : "Connect Manual Channel"
                }}
              </button>
            </form>

            <div
              v-if="sortedChannels.length === 0"
              class="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500"
            >
              No channels yet. Add one here or connect one through the Providers
              tab.
            </div>

            <div v-else class="mt-4 space-y-3">
              <div
                v-for="channel in sortedChannels"
                :key="channel.id"
                class="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">
                      {{ channel.channelTitle || channel.externalChannelId }}
                    </p>
                    <p
                      class="mt-1 text-xs tracking-[0.18em] text-slate-500 uppercase"
                    >
                      {{ humanizeProviderType(channel.providerType) }}
                    </p>
                  </div>

                  <button
                    class="btn-secondary-xs"
                    :disabled="deletingChannelId === channel.id"
                    @click="deleteChannel(channel)"
                  >
                    {{
                      deletingChannelId === channel.id
                        ? "Removing..."
                        : "Remove"
                    }}
                  </button>
                </div>

                <p class="mt-3 text-xs break-all text-slate-500">
                  {{ channel.externalChannelId }}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div
      v-if="selectedDate"
      class="fixed inset-0 z-50 bg-slate-900/20 p-3 backdrop-blur-sm sm:p-6"
      @click.self="closeDayModal"
    >
      <div
        class="mx-auto flex max-h-[94vh] max-w-6xl flex-col overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40"
      >
        <div
          class="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5"
        >
          <div>
            <p class="text-sm tracking-[0.24em] text-sky-600 uppercase">
              Day view
            </p>
            <h2 class="mt-2 text-2xl font-semibold text-slate-900">
              {{ selectedDayTitle }}
            </h2>
            <p class="mt-2 text-sm text-slate-500">
              Review what is scheduled here and queue the next post
            </p>
          </div>

          <button class="btn-secondary-sm" @click="closeDayModal">Close</button>
        </div>

        <div
          class="grid gap-6 overflow-y-auto p-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]"
        >
          <section>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">
                  Posts on this day
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  {{ selectedDayPosts.length }} post{{
                    selectedDayPosts.length === 1 ? "" : "s"
                  }}
                  on this day.
                </p>
              </div>
            </div>

            <div
              v-if="selectedDayPosts.length > 0"
              class="mt-4 flex flex-wrap gap-2 rounded-3xl bg-slate-100 p-1"
            >
              <button
                v-for="tab in dayViewPostTabs"
                :key="tab.value"
                class="rounded-2xl px-4 py-2 text-sm font-semibold transition"
                :class="segmentedButtonClasses(dayViewPostsTab === tab.value)"
                @click="dayViewPostsTab = tab.value"
              >
                {{ tab.label }}
                <span class="ml-2 text-xs text-slate-500">
                  {{ tab.count }}
                </span>
              </button>
            </div>

            <div
              v-if="selectedDayPosts.length === 0"
              class="mt-4 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500"
            >
              Nothing is on this day yet.
            </div>

            <div
              v-else-if="visibleSelectedDayPosts.length === 0"
              class="mt-4 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500"
            >
              {{
                dayViewPostsTab === "published"
                  ? "No published posts on this day yet."
                  : "No scheduled or in-progress posts on this day."
              }}
            </div>

            <div v-else class="mt-4 space-y-4">
              <article
                v-for="post in visibleSelectedDayPosts"
                :key="post.id"
                class="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5"
              >
                <div
                  class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        class="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {{ formatTime(post.scheduledPublishAt!) }}
                      </span>
                      <span
                        class="rounded-full px-3 py-1 text-xs font-semibold"
                        :class="statusClasses(post.status)"
                      >
                        {{ post.status }}
                      </span>
                    </div>

                    <h4 class="mt-3 text-lg font-semibold text-slate-900">
                      {{ post.title || "Untitled post" }}
                    </h4>
                    <p
                      v-if="post.description"
                      class="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-600"
                    >
                      {{ post.description }}
                    </p>
                    <p
                      class="mt-2 text-xs tracking-[0.18em] text-slate-500 uppercase"
                    >
                      {{ post.targetPrivacy }}
                    </p>
                  </div>

                  <button
                    class="btn-secondary-xs"
                    :disabled="deletingPostId === post.id"
                    @click="deleteScheduledPost(post)"
                  >
                    {{ deletingPostId === post.id ? "Deleting..." : "Delete" }}
                  </button>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <span
                    v-for="destination in post.destinations"
                    :key="destination.id"
                    class="rounded-full bg-white px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                  >
                    {{ destinationLabel(destination) }}
                  </span>
                </div>

                <div v-if="shouldShowDestinationResults(post)" class="mt-4">
                  <button
                    type="button"
                    class="btn-secondary"
                    @click="toggleDeliveryResults(post.id)"
                  >
                    {{
                      isDeliveryResultsExpanded(post.id)
                        ? "Hide delivery results"
                        : "Show delivery results"
                    }}
                  </button>

                  <div
                    v-if="isDeliveryResultsExpanded(post.id)"
                    class="mt-3 rounded-3xl border border-slate-200 bg-white p-4"
                  >
                    <div
                      class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <p class="text-sm font-semibold text-slate-900">
                          Delivery results
                        </p>
                        <p class="mt-1 text-sm text-slate-500">
                          {{ postResultSummary(post) }}
                        </p>
                      </div>
                    </div>

                    <div class="mt-4 space-y-3">
                      <div
                        v-for="destination in post.destinations"
                        :key="`${post.id}-${destination.id}-result`"
                        class="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div
                          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div>
                            <p class="text-sm font-semibold text-slate-900">
                              {{ destinationLabel(destination) }}
                            </p>
                            <p
                              class="mt-1 text-xs tracking-[0.18em] text-slate-500 uppercase"
                            >
                              {{
                                humanizeProviderType(destination.providerType)
                              }}
                            </p>
                          </div>

                          <span
                            class="rounded-full px-3 py-1 text-xs font-semibold"
                            :class="statusClasses(destination.status)"
                          >
                            {{ destination.status }}
                          </span>
                        </div>

                        <p
                          v-if="destination.status === 'failed'"
                          class="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
                        >
                          {{ destinationErrorText(destination) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section
            class="rounded-[1.75rem] border border-slate-200 bg-white p-5"
          >
            <div>
              <h3 class="text-lg font-semibold text-slate-900">
                Schedule another post
              </h3>
              <p class="mt-1 text-sm text-slate-500">
                The date is fixed to {{ selectedDate.format("MMM D, YYYY") }}.
                Choose a time, channels, and any files you need.
              </p>
            </div>

            <div
              v-if="selectedDayIsPast"
              class="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200"
            >
              This day is already in the past. Pick today or a future date to
              schedule something new.
            </div>

            <form class="mt-5 space-y-4" @submit.prevent="schedulePost">
              <label class="block space-y-2">
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >Title</span
                >
                <input
                  v-model="scheduleForm.title"
                  type="text"
                  required
                  class="field-input"
                  placeholder="What are you posting?"
                />
              </label>

              <label class="block space-y-2">
                <span
                  class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >Description</span
                >
                <textarea
                  v-model="scheduleForm.description"
                  rows="4"
                  class="field-input"
                  placeholder="Optional description"
                />
              </label>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block space-y-2">
                  <span
                    class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                    >Time</span
                  >
                  <input
                    v-model="scheduleForm.time"
                    type="time"
                    required
                    class="field-input"
                  />
                </label>

                <label class="block space-y-2">
                  <span
                    class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                    >Privacy</span
                  >
                  <div ref="privacyEl" class="relative">
                    <button
                      type="button"
                      class="field-select flex w-full items-center justify-between bg-slate-50 text-left"
                      @click="openPrivacy = !openPrivacy"
                    >
                      <span>{{ scheduleForm.privacy }}</span>
                      <ChevronDown
                        class="ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform"
                        :class="{ 'rotate-180': openPrivacy }"
                      />
                    </button>
                    <div
                      v-if="openPrivacy"
                      class="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                    >
                      <div
                        v-for="option in PRIVACY_OPTIONS"
                        :key="option"
                        class="cursor-pointer px-4 py-3 text-sm transition hover:bg-slate-50"
                        :class="{
                          'bg-sky-50 font-semibold text-sky-600':
                            scheduleForm.privacy === option,
                        }"
                        @click.prevent="
                          scheduleForm.privacy = option;
                          openPrivacy = false;
                        "
                      >
                        {{ option }}
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              <div class="space-y-3">
                <div>
                  <p
                    class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                  >
                    Channels
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    Pick one or more connected channels.
                  </p>
                </div>

                <div
                  v-if="sortedChannels.length === 0"
                  class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                >
                  No channels yet. Connect one from the sidebar first.
                </div>

                <div v-else class="space-y-2">
                  <label
                    v-for="channel in sortedChannels"
                    :key="channel.id"
                    class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <input
                      v-model="scheduleForm.channelIds"
                      :value="channel.id"
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border-slate-300 bg-white text-sky-600"
                    />
                    <span>
                      <span class="flex flex-wrap items-baseline gap-x-2">
                        <span class="font-medium text-slate-900">
                          {{
                            channel.channelTitle || channel.externalChannelId
                          }}
                        </span>
                        <span
                          v-if="channelMediaWarning(channel)"
                          class="text-xs font-medium text-rose-600"
                        >
                          {{ channelMediaWarning(channel) }}
                        </span>
                        <span
                          v-if="channelProviderNote(channel)"
                          class="text-xs text-slate-500"
                        >
                          {{ channelProviderNote(channel) }}
                        </span>
                      </span>
                      <span
                        class="mt-1 block text-xs tracking-[0.18em] text-slate-500 uppercase"
                      >
                        {{ humanizeProviderType(channel.providerType) }}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div class="space-y-3">
                <div
                  class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
                >
                  <div>
                    <p
                      class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                    >
                      Files
                    </p>
                    <p class="mt-1 text-xs text-slate-500">
                      Upload JPEG, PNG, or MP4 files and attach them to this
                      scheduled post.
                    </p>
                  </div>

                  <label
                    class="btn-secondary inline-flex cursor-pointer items-center justify-center"
                  >
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,video/mp4"
                      class="hidden"
                      @change="uploadSelectedFiles"
                    />
                    {{ uploadingFiles ? "Uploading..." : "Upload files" }}
                  </label>
                </div>

                <div
                  v-if="sortedFiles.length === 0"
                  class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                >
                  No uploaded files yet.
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-if="sessionUploadedFiles.length === 0"
                    class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                  >
                    No files uploaded in this session yet.
                  </div>

                  <div v-else class="max-h-60 space-y-2 overflow-y-auto pr-1">
                    <label
                      v-for="file in sessionUploadedFiles"
                      :key="file.id"
                      class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      <input
                        v-model="scheduleForm.fileIds"
                        :value="file.id"
                        type="checkbox"
                        class="mt-1 h-4 w-4 rounded border-slate-300 bg-white text-sky-600"
                      />
                      <span class="min-w-0 flex-1">
                        <span
                          class="block truncate font-medium text-slate-900"
                          >{{ file.fileName }}</span
                        >
                        <span class="mt-1 block text-xs text-slate-500">
                          {{ file.contentType }} ·
                          {{ formatBytes(file.sizeBytes) }}
                        </span>
                      </span>
                    </label>
                  </div>

                  <button
                    v-if="pastUploadedFiles.length > 0"
                    type="button"
                    class="btn-secondary"
                    @click="showPastUploadedFiles = !showPastUploadedFiles"
                  >
                    {{
                      showPastUploadedFiles
                        ? "Hide past uploaded files"
                        : `Show past uploaded files (${pastUploadedFiles.length})`
                    }}
                  </button>

                  <div
                    v-if="showPastUploadedFiles && pastUploadedFiles.length > 0"
                    class="space-y-2"
                  >
                    <p
                      class="text-xs font-medium tracking-[0.18em] text-slate-500 uppercase"
                    >
                      Past uploads
                    </p>
                    <div class="max-h-60 space-y-2 overflow-y-auto pr-1">
                      <label
                        v-for="file in pastUploadedFiles"
                        :key="file.id"
                        class="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <input
                          v-model="scheduleForm.fileIds"
                          :value="file.id"
                          type="checkbox"
                          class="mt-1 h-4 w-4 rounded border-slate-300 bg-white text-sky-600"
                        />
                        <span class="min-w-0 flex-1">
                          <span
                            class="block truncate font-medium text-slate-900"
                            >{{ file.fileName }}</span
                          >
                          <span class="mt-1 block text-xs text-slate-500">
                            {{ file.contentType }} ·
                            {{ formatBytes(file.sizeBytes) }}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="composerWarning"
                class="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200"
              >
                {{ composerWarning }}
              </div>

              <button
                type="submit"
                class="btn-primary w-full"
                :disabled="scheduling || !canSubmitSchedule"
              >
                {{
                  scheduling
                    ? "Scheduling..."
                    : `Schedule for ${selectedDate.format("MMM D")}`
                }}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>

    <div
      v-if="notice"
      class="pointer-events-none fixed inset-x-0 top-4 z-70 flex justify-center px-4"
    >
      <div
        class="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg"
        :class="noticeClasses(notice.type)"
      >
        <p class="min-w-0 flex-1 leading-6">
          {{ notice.message }}
        </p>
        <button
          type="button"
          class="rounded-xl px-2 py-1 text-xs font-semibold text-current transition hover:bg-black/5"
          @click="clearNotice"
        >
          Close
        </button>
      </div>
    </div>

    <div
      v-if="providerAuthorizationDialog"
      class="fixed inset-0 z-55 bg-slate-900/35 p-4 backdrop-blur-sm"
      @click.self="closeProviderAuthorizationDialog"
    >
      <div
        class="mx-auto mt-[10vh] max-w-2xl rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/40"
      >
        <p class="text-sm tracking-[0.24em] text-sky-600 uppercase">
          Provider authorization
        </p>
        <h3 class="mt-3 text-2xl font-semibold text-slate-900">
          Connect
          {{ humanizeProviderType(providerAuthorizationDialog.providerType) }}
        </h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          Copy this authorization URL, complete the OAuth flow in another tab,
          then come back here and refresh channels.
        </p>

        <div
          class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-sans text-xs break-all text-slate-700"
        >
          {{ providerAuthorizationDialog.authorizationUrl }}
        </div>

        <div
          class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end"
        >
          <button
            type="button"
            class="btn-secondary"
            @click="closeProviderAuthorizationDialog"
          >
            Close
          </button>
          <button
            type="button"
            class="btn-secondary"
            @click="
              copyToClipboard(
                providerAuthorizationDialog.authorizationUrl,
                'Authorization URL copied.',
              )
            "
          >
            Copy URL
          </button>
          <button
            type="button"
            class="btn-secondary"
            :disabled="refreshingAuthorizedProvider"
            @click="refreshProviderAuthorization"
          >
            {{
              refreshingAuthorizedProvider
                ? "Refreshing..."
                : "Refresh channels"
            }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="confirmDialog"
      class="fixed inset-0 z-60 bg-slate-900/35 p-4 backdrop-blur-sm"
      @click.self="cancelConfirmation"
    >
      <div
        class="mx-auto mt-[12vh] max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/40"
      >
        <p class="text-sm tracking-[0.24em] text-sky-600 uppercase">
          Confirm action
        </p>
        <h3 class="mt-3 text-2xl font-semibold text-slate-900">
          {{ confirmDialog.title }}
        </h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">
          {{ confirmDialog.message }}
        </p>

        <div
          class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"
        >
          <button
            type="button"
            autofocus
            class="btn-secondary"
            @click="cancelConfirmation"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-2xl px-4 py-3 text-sm font-semibold text-white transition"
            :class="
              confirmDialog.confirmTone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-sky-600 hover:bg-sky-700'
            "
            @click="confirmCurrentAction"
          >
            {{ confirmDialog.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, Crown, LogOut, User } from "@lucide/vue";
import {
  onClickOutside,
  useClipboard,
  useEventListener,
  useStorage,
} from "@vueuse/core";
import dayjs, { type Dayjs } from "dayjs";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  type Ref,
  watch,
} from "vue";

type AuthMode = "signin" | "signup";
type DashboardTab = "calendar" | "providers" | "channels";
type DayViewPostsTab = "published" | "scheduledAndOther";
type NoticeType = "error" | "info" | "success";
type Privacy = "private" | "public" | "unlisted";
type ProviderType =
  | "bluesky"
  | "discord"
  | "linkedin"
  | "mastodon"
  | "telegram"
  | "tiktok"
  | "x"
  | "youtube";
type PostStatus = "failed" | "partiallyPublished" | "published" | "scheduled";
type DestinationStatus = "failed" | "published" | "scheduled";

type User = {
  id: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
};

type Provider = {
  id: string;
  type: ProviderType;
  userId: string | null;
  clientId: string;
  clientSecret: string;
  extra: string;
};

type Channel = {
  id: string;
  userId: string;
  providerId: string | null;
  providerType: ProviderType;
  externalChannelId: string;
  channelTitle: string | null;
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
};

type StoredFile = {
  id: string;
  userId: string;
  sha256: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

type PostDestination = {
  id: string;
  postId: string;
  channelId: string;
  providerType: ProviderType;
  channelTitle: string | null;
  externalPostId: string | null;
  status: DestinationStatus;
  errorMessage: string | null;
  publishedAt: number | null;
};

type Post = {
  id: string;
  title: string;
  description: string | null;
  targetPrivacy: Privacy;
  scheduledPublishAt: number | null;
  status: PostStatus;
  destinations: PostDestination[];
};

type ProviderCapability = {
  providerType: ProviderType;
  image: boolean;
  video: boolean;
};

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  confirmTone: "default" | "danger";
  resolver: (value: boolean) => void;
};

type ProviderAuthorizationDialog = {
  providerType: ProviderType;
  authorizationUrl: string;
};

type CalendarDay = {
  date: Dayjs;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: Post[];
  key: string;
};

const TOKEN_STORAGE_KEY = "token";
const DEFAULT_API_BASE = "/api";
const OAUTH_PROVIDER_TYPES: ProviderType[] = [
  "linkedin",
  "mastodon",
  "tiktok",
  "x",
  "youtube",
];
const MANUAL_PROVIDER_TYPES: ProviderType[] = [
  "bluesky",
  "discord",
  "telegram",
];
const PRIVACY_OPTIONS: Privacy[] = ["private", "unlisted", "public"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NOTICE_TIMEOUT_MS = 4000;
const HERO_STATS = [
  {
    label: "View",
    value: "One monthly calendar",
  },
  {
    label: "Flow",
    value: "Click a day to schedule",
  },
  {
    label: "Channels",
    value: "Bluesky, Discord, LinkedIn, Mastodon, Telegram, TikTok, X, YouTube",
  },
];
const AUTH_MODE_OPTIONS: Array<{ value: AuthMode; label: string }> = [
  {
    value: "signin",
    label: "Sign In",
  },
  {
    value: "signup",
    label: "Sign Up",
  },
];
const DASHBOARD_TABS: Array<{ value: DashboardTab; label: string }> = [
  {
    value: "calendar",
    label: "Calendar",
  },
  {
    value: "providers",
    label: "Providers",
  },
  {
    value: "channels",
    label: "Channels",
  },
];
const PROVIDER_META: Record<
  ProviderType,
  {
    label: string;
    publishingNote: string;
    credentialLabel?: string;
    credentialHelp?: string;
    extraField?: {
      label: string;
      placeholder: string;
      help: string;
    };
  }
> = {
  bluesky: {
    label: "Bluesky",
    publishingNote: "Privacy setting is ignored.",
    credentialLabel: "Email",
    credentialHelp: "Enter your Bluesky email and password.",
  },
  discord: {
    label: "Discord",
    publishingNote: "Privacy setting is ignored.",
    credentialLabel: "Webhook URL",
    credentialHelp:
      "Paste the Discord webhook URL for the channel where you want to post.",
  },
  linkedin: {
    label: "LinkedIn",
    publishingNote: "Publishes publicly on your personal profile.",
  },
  mastodon: {
    label: "Mastodon",
    publishingNote: "",
    extraField: {
      label: "Instance URL",
      placeholder: "https://mastodon.social",
      help: "Enter the base URL of the Mastodon instance for this app, for example https://mastodon.social.",
    },
  },
  telegram: {
    label: "Telegram",
    publishingNote: "Privacy setting is ignored.",
    credentialLabel: "Bot token",
    credentialHelp:
      "Paste the Telegram bot token. The bot must already have access to the target DM or group chat. Send a message to the bot from the target chat.",
  },
  tiktok: {
    label: "TikTok",
    publishingNote:
      "Unverified apps may fail; non-public posts publish as private.",
  },
  x: {
    label: "X",
    publishingNote: "Privacy setting is ignored.",
  },
  youtube: {
    label: "YouTube",
    publishingNote: "",
  },
};

const token = useStorage(
  TOKEN_STORAGE_KEY,
  typeof window === "undefined" ? "" : readStoredSessionToken(),
  undefined,
  { writeDefaults: false },
);
const apiBase = DEFAULT_API_BASE;
const booting = ref(true);
const loading = ref(false);
const refreshing = ref(false);
const uploadingFiles = ref(false);
const scheduling = ref(false);
const savingProvider = ref(false);
const connectingProviderId = ref("");
const refreshingAuthorizedProvider = ref(false);
const savingManualChannel = ref(false);
const deletingPostId = ref("");
const deletingChannelId = ref("");
const deletingProviderId = ref("");
const authMode = ref<AuthMode>("signin");
const activeTab = ref<DashboardTab>("calendar");
const showProviderForm = ref(false);
const showChannelForm = ref(false);
const showUserMenu = ref(false);
const openProvider = ref(false);
const openManualProvider = ref(false);
const openPrivacy = ref(false);
const providerEl = ref<HTMLElement | null>(null);
const manualProviderEl = ref<HTMLElement | null>(null);
const privacyEl = ref<HTMLElement | null>(null);
onClickOutside(providerEl, () => {
  openProvider.value = false;
});
onClickOutside(manualProviderEl, () => {
  openManualProvider.value = false;
});
onClickOutside(privacyEl, () => {
  openPrivacy.value = false;
});
const notice = ref<{ type: NoticeType; message: string } | null>(null);
const noticeTimerId = ref<number | null>(null);
const confirmDialog = ref<ConfirmDialog | null>(null);
const providerAuthorizationDialog = ref<ProviderAuthorizationDialog | null>(
  null,
);
const user = ref<User | null>(null);
const posts = ref<Post[]>([]);
const channels = ref<Channel[]>([]);
const providers = ref<Provider[]>([]);
const files = ref<StoredFile[]>([]);
const providerCapabilities = ref<ProviderCapability[]>([]);
const sessionUploadedFileIds = ref<string[]>([]);
const currentMonth = ref(dayjs().startOf("month"));
const selectedDayKey = ref("");
const dayViewPostsTab = ref<DayViewPostsTab>("scheduledAndOther");
const showPastUploadedFiles = ref(false);
const expandedDeliveryResultPostIds = ref<string[]>([]);
const { copy, isSupported: isClipboardSupported } = useClipboard();

const authForm = reactive({
  email: "",
  password: "",
});

const providerForm = reactive({
  type: "youtube" as ProviderType,
  clientId: "",
  clientSecret: "",
  extra: "",
  isGlobal: false,
});

const manualChannelForm = reactive({
  providerType: "discord" as ProviderType,
  accessToken: "",
  password: "",
});

const scheduleForm = reactive({
  title: "",
  description: "",
  privacy: "private" as Privacy,
  time: defaultTimeForDate(dayjs()),
  channelIds: [] as string[],
  fileIds: [] as string[],
});

const selectedDate = computed(() =>
  selectedDayKey.value ? dayjs(selectedDayKey.value) : null,
);
const selectedDayTitle = computed(() =>
  selectedDate.value ? selectedDate.value.format("dddd, MMMM D, YYYY") : "",
);
const selectedDayIsPast = computed(() =>
  selectedDate.value
    ? selectedDate.value.endOf("day").isBefore(dayjs())
    : false,
);
const sortedChannels = computed(() =>
  [...channels.value].sort((a, b) => {
    const aLabel = (a.channelTitle || a.externalChannelId).toLowerCase();
    const bLabel = (b.channelTitle || b.externalChannelId).toLowerCase();
    return aLabel.localeCompare(bLabel);
  }),
);
const sortedProviders = computed(() =>
  [...providers.value].sort((a, b) => {
    if (a.type === b.type) {
      return a.clientId.localeCompare(b.clientId);
    }
    return humanizeProviderType(a.type).localeCompare(
      humanizeProviderType(b.type),
    );
  }),
);
const sortedFiles = computed(() =>
  [...files.value].sort((a, b) => a.fileName.localeCompare(b.fileName)),
);
const sessionUploadedFileIdSet = computed(
  () => new Set(sessionUploadedFileIds.value),
);
const sessionUploadedFiles = computed(() =>
  sortedFiles.value.filter((file) =>
    sessionUploadedFileIdSet.value.has(file.id),
  ),
);
const pastUploadedFiles = computed(() =>
  sortedFiles.value.filter(
    (file) => !sessionUploadedFileIdSet.value.has(file.id),
  ),
);
const scheduledPosts = computed(() =>
  posts.value
    .filter((post) => post.scheduledPublishAt !== null)
    .sort((a, b) => a.scheduledPublishAt! - b.scheduledPublishAt!),
);
const postsByDay = computed(() => {
  const map: Record<string, Post[]> = {};

  for (const post of scheduledPosts.value) {
    const key = dayjs.unix(post.scheduledPublishAt!).format("YYYY-MM-DD");
    map[key] ??= [];
    map[key].push(post);
  }

  return map;
});
const selectedDayPosts = computed(() => {
  if (!selectedDayKey.value) {
    return [] as Post[];
  }

  return [...(postsByDay.value[selectedDayKey.value] ?? [])].sort(
    (a, b) => a.scheduledPublishAt! - b.scheduledPublishAt!,
  );
});
const selectedDayPublishedPosts = computed(() =>
  selectedDayPosts.value.filter((post) => post.status === "published"),
);
const selectedDayScheduledAndOtherPosts = computed(() =>
  selectedDayPosts.value.filter((post) => post.status !== "published"),
);
const visibleSelectedDayPosts = computed(() =>
  dayViewPostsTab.value === "published"
    ? selectedDayPublishedPosts.value
    : selectedDayScheduledAndOtherPosts.value,
);
const dayViewPostTabs = computed(() => [
  {
    value: "scheduledAndOther" as const,
    label: "Scheduled & other",
    count: selectedDayScheduledAndOtherPosts.value.length,
  },
  {
    value: "published" as const,
    label: "Published",
    count: selectedDayPublishedPosts.value.length,
  },
]);
const calendarDays = computed(() => {
  const monthStart = currentMonth.value.startOf("month");
  const monthEnd = currentMonth.value.endOf("month");
  const gridStart = monthStart.startOf("week");
  const gridEnd = monthEnd.endOf("week");
  const days: CalendarDay[] = [];
  const todayKey = dayjs().format("YYYY-MM-DD");

  for (
    let cursor = gridStart;
    cursor.isBefore(gridEnd) || cursor.isSame(gridEnd, "day");
    cursor = cursor.add(1, "day")
  ) {
    const key = cursor.format("YYYY-MM-DD");

    days.push({
      date: cursor,
      isCurrentMonth: cursor.isSame(currentMonth.value, "month"),
      isToday: key === todayKey,
      posts: postsByDay.value[key] ?? [],
      key,
    });
  }

  return days;
});
const selectedChannelTypes = computed(() => {
  const types = new Set<ProviderType>();

  for (const channelId of scheduleForm.channelIds) {
    const channel = channels.value.find(
      (candidate) => candidate.id === channelId,
    );
    if (channel) {
      types.add(channel.providerType);
    }
  }

  return types;
});
const composerWarning = computed(() => {
  if (
    selectedChannelTypes.value.has("youtube") &&
    scheduleForm.fileIds.length === 0
  ) {
    return "YouTube requires at least one uploaded file.";
  }

  if (selectedChannelTypes.value.has("x") && scheduleForm.fileIds.length > 0) {
    return "Files are not currently supported for X.";
  }

  return "";
});
const canSubmitSchedule = computed(
  () =>
    scheduleForm.channelIds.length > 0 &&
    scheduleForm.time.trim() !== "" &&
    !selectedDayIsPast.value &&
    composerWarning.value === "",
);
const isAuthenticated = computed(() => isSessionTokenActive(token.value));
const providerRedirectUri = computed(() => {
  if (typeof window === "undefined") {
    return "";
  }

  return new URL(
    `/api/oauth/${providerForm.type}/callback`,
    window.location.origin,
  ).toString();
});
const selectedProviderMeta = computed(() => PROVIDER_META[providerForm.type]);
const selectedManualProviderMeta = computed(
  () => PROVIDER_META[manualChannelForm.providerType],
);

let sessionExpiryTimeoutId: number | null = null;

function setNotice(type: NoticeType, message: string) {
  if (noticeTimerId.value !== null) {
    window.clearTimeout(noticeTimerId.value);
    noticeTimerId.value = null;
  }

  notice.value = { type, message };
  noticeTimerId.value = window.setTimeout(() => {
    notice.value = null;
    noticeTimerId.value = null;
  }, NOTICE_TIMEOUT_MS);
}

function clearNotice() {
  if (noticeTimerId.value !== null) {
    window.clearTimeout(noticeTimerId.value);
    noticeTimerId.value = null;
  }

  notice.value = null;
}

function noticeClasses(type: NoticeType) {
  return type === "error"
    ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
    : type === "success"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
}

function requestConfirmation(input: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmTone?: ConfirmDialog["confirmTone"];
}) {
  if (confirmDialog.value) {
    const { resolver } = confirmDialog.value;
    confirmDialog.value = null;
    resolver(false);
  }

  return new Promise<boolean>((resolve) => {
    confirmDialog.value = {
      title: input.title,
      message: input.message,
      confirmLabel: input.confirmLabel ?? "Confirm",
      confirmTone: input.confirmTone ?? "default",
      resolver: resolve,
    };
  });
}

function resolveConfirmation(result: boolean) {
  const currentDialog = confirmDialog.value;
  if (!currentDialog) {
    return;
  }

  confirmDialog.value = null;
  currentDialog.resolver(result);
}

function cancelConfirmation() {
  resolveConfirmation(false);
}

function confirmCurrentAction() {
  resolveConfirmation(true);
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return atob(`${normalized}${"=".repeat(padding)}`);
}

function getSessionTokenExpiration(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) {
    return 0;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp
      : 0;
  } catch {
    return 0;
  }
}

function isSessionTokenActive(value: string) {
  if (!value) {
    return false;
  }

  return getSessionTokenExpiration(value) > dayjs().unix();
}

function readStoredSessionToken() {
  const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  if (!storedToken) {
    return "";
  }

  if (isSessionTokenActive(storedToken)) {
    return storedToken;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  return "";
}

function clearSessionExpiryTimeout() {
  if (typeof window === "undefined" || sessionExpiryTimeoutId === null) {
    return;
  }

  window.clearTimeout(sessionExpiryTimeoutId);
  sessionExpiryTimeoutId = null;
}

function scheduleSessionExpiryTimeout() {
  clearSessionExpiryTimeout();

  if (typeof window === "undefined" || !token.value) {
    return;
  }

  const expiresAt = getSessionTokenExpiration(token.value);
  const delay = expiresAt * 1000 - Date.now();

  if (delay <= 0) {
    clearSession();
    setNotice("info", "Your session expired. Sign in again.");
    return;
  }

  sessionExpiryTimeoutId = window.setTimeout(() => {
    clearSession();
    setNotice("info", "Your session expired. Sign in again.");
  }, delay);
}

async function copyToClipboard(value: string, successMessage: string) {
  if (!isClipboardSupported.value) {
    setNotice("error", "Clipboard access is not available here.");
    return;
  }

  try {
    await copy(value);
    setNotice("success", successMessage);
  } catch {
    setNotice("error", "Could not copy to clipboard.");
  }
}

function segmentedButtonClasses(isActive: boolean) {
  return isActive
    ? "bg-white text-slate-900 shadow-sm"
    : "text-slate-600 hover:text-slate-900";
}

function getActionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function runBusyAction(
  busyState: Ref<boolean>,
  fallback: string,
  action: () => Promise<void>,
  options: { clearExistingNotice?: boolean } = {},
) {
  busyState.value = true;

  if (options.clearExistingNotice ?? true) {
    clearNotice();
  }

  try {
    await action();
    return true;
  } catch (error) {
    setNotice("error", getActionErrorMessage(error, fallback));
    return false;
  } finally {
    busyState.value = false;
  }
}

async function runBusyIdAction(
  busyState: Ref<string>,
  id: string,
  fallback: string,
  action: () => Promise<void>,
  options: { clearExistingNotice?: boolean } = {},
) {
  busyState.value = id;

  if (options.clearExistingNotice ?? true) {
    clearNotice();
  }

  try {
    await action();
    return true;
  } catch (error) {
    setNotice("error", getActionErrorMessage(error, fallback));
    return false;
  } finally {
    busyState.value = "";
  }
}

function clearSession() {
  clearSessionExpiryTimeout();
  cancelConfirmation();
  clearNotice();
  token.value = "";
  user.value = null;
  posts.value = [];
  channels.value = [];
  providers.value = [];
  files.value = [];
  sessionUploadedFileIds.value = [];
  showPastUploadedFiles.value = false;
  providerAuthorizationDialog.value = null;

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function humanizeProviderType(type: ProviderType) {
  return PROVIDER_META[type].label;
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (confirmDialog.value) {
      event.preventDefault();
      cancelConfirmation();
      return;
    }
    if (providerAuthorizationDialog.value) {
      closeProviderAuthorizationDialog();
      return;
    }
    showUserMenu.value = false;
    openProvider.value = false;
    openManualProvider.value = false;
    openPrivacy.value = false;
  }
}

function handleDocumentClick() {
  showUserMenu.value = false;
}

if (typeof document !== "undefined") {
  useEventListener(document, "keydown", handleDocumentKeyDown);
  useEventListener(document, "click", handleDocumentClick);
}

watch(
  () => providerForm.type,
  (type) => {
    if (!PROVIDER_META[type].extraField) {
      providerForm.extra = "";
    }
  },
);

watch(
  () => manualChannelForm.providerType,
  (type) => {
    if (type !== "bluesky") {
      manualChannelForm.password = "";
    }
  },
);

watch(
  token,
  () => {
    scheduleSessionExpiryTimeout();
  },
  { immediate: true },
);

function defaultTimeForDate(date: Dayjs) {
  const now = dayjs();

  if (!date.isSame(now, "day")) {
    return "09:00";
  }

  const nextHour = now.add(1, "hour").startOf("hour");
  return nextHour.isSame(now, "day") ? nextHour.format("HH:mm") : "23:59";
}

function formatTime(timestamp: number) {
  return dayjs.unix(timestamp).format("h:mm A");
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClasses(status: PostStatus | DestinationStatus) {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "scheduled":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "partiallyPublished":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "failed":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
}

function shouldShowDestinationResults(post: Post) {
  return post.status === "partiallyPublished" || post.status === "failed";
}

function destinationLabel(destination: PostDestination) {
  return (
    destination.channelTitle || humanizeProviderType(destination.providerType)
  );
}

function destinationErrorText(destination: PostDestination) {
  if (destination.errorMessage?.trim()) {
    return destination.errorMessage;
  }

  return "No error details were returned for this destination.";
}

function channelProviderNote(channel: Channel) {
  if (!scheduleForm.channelIds.includes(channel.id)) {
    return "";
  }

  return PROVIDER_META[channel.providerType].publishingNote;
}

function channelMediaWarning(channel: Channel) {
  if (scheduleForm.fileIds.length === 0) {
    return "";
  }

  const capability = providerCapabilities.value.find(
    (candidate) => candidate.providerType === channel.providerType,
  );
  if (!capability) {
    return "";
  }

  const selectedFiles = files.value.filter((file) =>
    scheduleForm.fileIds.includes(file.id),
  );
  const hasImage = selectedFiles.some((file) =>
    file.contentType.startsWith("image/"),
  );
  const hasVideo = selectedFiles.some((file) =>
    file.contentType.startsWith("video/"),
  );

  const ignored: string[] = [];
  if (hasImage && !capability.image) {
    ignored.push("image");
  }
  if (hasVideo && !capability.video) {
    ignored.push("video");
  }

  if (ignored.length === 0) {
    return "";
  }

  return `${ignored.join(" and ")} will be ignored`;
}

function postResultSummary(post: Post) {
  return post.status === "partiallyPublished"
    ? "Some destinations published successfully, while others failed."
    : "Publishing failed. Review the destination errors below.";
}

function isDeliveryResultsExpanded(postId: string) {
  return expandedDeliveryResultPostIds.value.includes(postId);
}

function toggleDeliveryResults(postId: string) {
  expandedDeliveryResultPostIds.value = isDeliveryResultsExpanded(postId)
    ? expandedDeliveryResultPostIds.value.filter((id) => id !== postId)
    : [...expandedDeliveryResultPostIds.value, postId];
}

function openDay(key: string) {
  selectedDayKey.value = key;
  dayViewPostsTab.value = "scheduledAndOther";
  expandedDeliveryResultPostIds.value = [];
  resetScheduleForm();
}

function closeDayModal() {
  selectedDayKey.value = "";
  dayViewPostsTab.value = "scheduledAndOther";
  expandedDeliveryResultPostIds.value = [];
}

function resetScheduleForm() {
  const selected = selectedDate.value ?? dayjs();
  scheduleForm.title = "";
  scheduleForm.description = "";
  scheduleForm.privacy = "private";
  scheduleForm.time = defaultTimeForDate(selected);
  scheduleForm.channelIds = [];
  scheduleForm.fileIds = [];
  showPastUploadedFiles.value = false;
}

function previousMonth() {
  currentMonth.value = currentMonth.value.subtract(1, "month");
}

function nextMonth() {
  currentMonth.value = currentMonth.value.add(1, "month");
}

function goToCurrent() {
  currentMonth.value = dayjs().startOf("month");
}

function canDeleteProvider(provider: Provider) {
  if (!user.value) {
    return false;
  }

  if (provider.userId === null) {
    return user.value.isAdmin;
  }

  return provider.userId === user.value.id;
}

async function readResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallback;
}

async function apiRequest<T>(path: string, init?: RequestInit) {
  const base = apiBase;
  const headers = new Headers(init?.headers ?? {});
  if (token.value) {
    if (!isSessionTokenActive(token.value)) {
      clearSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    headers.set("Authorization", `Bearer ${token.value}`);
  }
  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  const payload = await readResponse(response);

  if (response.ok) {
    return payload as T;
  }

  const message = getErrorMessage(
    payload,
    `Request failed (${response.status}).`,
  );

  if (response.status === 401 && token.value) {
    clearSession();
  }

  throw new Error(message);
}

async function loadAppData() {
  const [
    meResult,
    postResult,
    channelResult,
    providerResult,
    fileResult,
    capabilityResult,
  ] = await Promise.all([
    apiRequest<{ user: User }>("/users/me"),
    apiRequest<{ posts: Post[] }>("/posts"),
    apiRequest<{ channels: Channel[] }>("/channels"),
    apiRequest<{ providers: Provider[] }>("/providers"),
    apiRequest<{ files: StoredFile[] }>("/files"),
    apiRequest<{ capabilities: ProviderCapability[] }>(
      "/providers/media-capabilities",
    ).catch((): { capabilities: ProviderCapability[] } => ({
      capabilities: [],
    })),
  ]);

  user.value = meResult.user;
  posts.value = postResult.posts;
  channels.value = channelResult.channels;
  providers.value = providerResult.providers;
  files.value = fileResult.files;
  providerCapabilities.value = capabilityResult.capabilities;
}

async function refreshData(showSuccess = false) {
  return runBusyAction(
    refreshing,
    "Refresh failed.",
    async () => {
      await loadAppData();
      if (showSuccess) {
        setNotice("success", "Data refreshed.");
      }
    },
    { clearExistingNotice: false },
  );
}

async function submitAuth() {
  await runBusyAction(loading, "Authentication failed.", async () => {
    const result = await apiRequest<{ token: string }>(
      authMode.value === "signin" ? "/auth/signin" : "/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({
          email: authForm.email.trim(),
          password: authForm.password,
        }),
      },
    );

    token.value = result.token;
    await loadAppData();
    authForm.password = "";
    setNotice(
      "success",
      authMode.value === "signin"
        ? "Signed in."
        : "Account created and signed in.",
    );
  });
}

async function createProvider() {
  await runBusyAction(savingProvider, "Provider creation failed.", async () => {
    await apiRequest<{ provider: Provider }>("/providers", {
      method: "POST",
      body: JSON.stringify({
        type: providerForm.type,
        clientId: providerForm.clientId.trim(),
        clientSecret: providerForm.clientSecret.trim(),
        extra: providerForm.extra.trim(),
        isGlobal: user.value?.isAdmin ? providerForm.isGlobal : false,
      }),
    });

    providerForm.clientId = "";
    providerForm.clientSecret = "";
    providerForm.extra = "";
    providerForm.isGlobal = false;
    showProviderForm.value = false;
    if (!(await refreshData())) {
      return;
    }
    setNotice("success", "Provider saved. Use Connect to authorize it.");
  });
}

function closeProviderAuthorizationDialog() {
  providerAuthorizationDialog.value = null;
}

async function refreshProviderAuthorization() {
  await runBusyAction(
    refreshingAuthorizedProvider,
    "Provider connection failed.",
    async () => {
      await loadAppData();
      providerAuthorizationDialog.value = null;
      setNotice("success", "Channels refreshed.");
    },
    { clearExistingNotice: false },
  );
}

async function connectProvider(provider: Provider) {
  await runBusyIdAction(
    connectingProviderId,
    provider.id,
    "Provider connection failed.",
    async () => {
      const result = await apiRequest<{ authorizationUrl: string }>(
        `/providers/${provider.id}/authorization-url`,
      );
      providerAuthorizationDialog.value = {
        providerType: provider.type,
        authorizationUrl: result.authorizationUrl,
      };
    },
  );
}

async function deleteProvider(provider: Provider) {
  if (!canDeleteProvider(provider)) {
    return;
  }

  if (
    !(await requestConfirmation({
      title: `Delete ${humanizeProviderType(provider.type)} provider?`,
      message:
        "This will remove the saved provider credentials for this connection.",
      confirmLabel: "Delete provider",
      confirmTone: "danger",
    }))
  ) {
    return;
  }

  await runBusyIdAction(
    deletingProviderId,
    provider.id,
    "Provider deletion failed.",
    async () => {
      await apiRequest(`/providers/${provider.id}`, { method: "DELETE" });
      if (!(await refreshData())) {
        return;
      }
      setNotice("success", "Provider deleted.");
    },
  );
}

async function createManualChannel() {
  await runBusyAction(
    savingManualChannel,
    "Channel connection failed.",
    async () => {
      const accessToken =
        manualChannelForm.providerType === "bluesky"
          ? `${manualChannelForm.accessToken.trim()}|${manualChannelForm.password}`
          : manualChannelForm.accessToken.trim();

      await apiRequest("/channels", {
        method: "POST",
        body: JSON.stringify({
          providerType: manualChannelForm.providerType,
          accessToken,
        }),
      });

      manualChannelForm.accessToken = "";
      manualChannelForm.password = "";
      showChannelForm.value = false;
      if (!(await refreshData())) {
        return;
      }
      setNotice("success", "Channels refreshed from that credential.");
    },
  );
}

async function deleteChannel(channel: Channel) {
  if (
    !(await requestConfirmation({
      title: `Remove ${channel.channelTitle || channel.externalChannelId}?`,
      message:
        "This channel will no longer be available in the scheduler until you connect it again.",
      confirmLabel: "Remove channel",
      confirmTone: "danger",
    }))
  ) {
    return;
  }

  await runBusyIdAction(
    deletingChannelId,
    channel.id,
    "Channel deletion failed.",
    async () => {
      await apiRequest(`/channels/${channel.id}`, { method: "DELETE" });
      scheduleForm.channelIds = scheduleForm.channelIds.filter(
        (id) => id !== channel.id,
      );
      if (!(await refreshData())) {
        return;
      }
      setNotice("success", "Channel removed.");
    },
  );
}

async function uploadSelectedFiles(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const selectedFiles = input?.files;

  if (!selectedFiles || selectedFiles.length === 0) {
    return;
  }

  try {
    await runBusyAction(uploadingFiles, "Upload failed.", async () => {
      const uploadedIds: string[] = [];

      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData();
        formData.set("file", file);
        const result = await apiRequest<{ file: StoredFile }>("/files", {
          method: "POST",
          body: formData,
        });
        uploadedIds.push(result.file.id);
      }

      sessionUploadedFileIds.value = Array.from(
        new Set([...sessionUploadedFileIds.value, ...uploadedIds]),
      );
      scheduleForm.fileIds = Array.from(
        new Set([...scheduleForm.fileIds, ...uploadedIds]),
      );
      if (!(await refreshData())) {
        return;
      }
      setNotice(
        "success",
        `${uploadedIds.length} file${uploadedIds.length === 1 ? "" : "s"} uploaded.`,
      );
    });
  } finally {
    if (input) {
      input.value = "";
    }
  }
}

async function schedulePost() {
  const selectedDateValue = selectedDate.value;
  if (!selectedDateValue) {
    return;
  }

  await runBusyAction(scheduling, "Scheduling failed.", async () => {
    const scheduledAt = dayjs(
      `${selectedDateValue.format("YYYY-MM-DD")}T${scheduleForm.time}`,
    ).unix();

    await apiRequest("/posts", {
      method: "POST",
      body: JSON.stringify({
        title: scheduleForm.title.trim(),
        description: scheduleForm.description.trim(),
        privacy: scheduleForm.privacy,
        scheduledAt,
        fileIds: scheduleForm.fileIds,
        channelIds: scheduleForm.channelIds,
      }),
    });

    if (!(await refreshData())) {
      return;
    }
    resetScheduleForm();
    setNotice("success", "Post scheduled.");
  });
}

async function deleteScheduledPost(post: Post) {
  if (
    !(await requestConfirmation({
      title: `Delete scheduled post \"${post.title || "Untitled post"}\"?`,
      message:
        "This removes the scheduled post and cancels publishing for all of its destinations.",
      confirmLabel: "Delete post",
      confirmTone: "danger",
    }))
  ) {
    return;
  }

  await runBusyIdAction(deletingPostId, post.id, "Delete failed.", async () => {
    await apiRequest(`/posts/${post.id}`, { method: "DELETE" });
    if (!(await refreshData())) {
      return;
    }
    setNotice("success", "Scheduled post deleted.");
  });
}

function signOut() {
  clearSession();
  setNotice("info", "Signed out.");
}

onMounted(async () => {
  if (!token.value) {
    booting.value = false;
    return;
  }

  try {
    await loadAppData();
  } catch (error) {
    clearSession();
    setNotice(
      "error",
      error instanceof Error ? error.message : "Session restore failed.",
    );
  } finally {
    booting.value = false;
  }
});

onBeforeUnmount(() => {
  clearSessionExpiryTimeout();
  if (noticeTimerId.value !== null) {
    window.clearTimeout(noticeTimerId.value);
    noticeTimerId.value = null;
  }
  cancelConfirmation();
});
</script>
