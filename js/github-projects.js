(function () {
    'use strict';

    var USER = 'EbrahimKaram';
    var SKIP_REPOS = {
        'EbrahimKaram.github.io': true
    };
    var OWN_HOSTS = {
        'ebrahimkaram.com': true,
        'www.ebrahimkaram.com': true,
        'ebrahimkaram.github.io': true
    };
    var PROFILE_URL = 'https://github.com/' + USER + '?tab=repositories';

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function sanitizeHomepage(homepage) {
        if (!homepage || typeof homepage !== 'string') {
            return '';
        }

        var cleaned = homepage.trim().replace(/\.+$/, '').trim();
        if (!/^https?:\/\//i.test(cleaned)) {
            return '';
        }

        try {
            var parsed = new URL(cleaned);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return '';
            }
            return parsed.href;
        } catch (err) {
            return '';
        }
    }

    function homepageHost(homepage) {
        try {
            return new URL(homepage).hostname.toLowerCase();
        } catch (err) {
            return '';
        }
    }

    function pagesUrl(repo) {
        return 'https://' + USER.toLowerCase() + '.github.io/' + encodeURIComponent(repo.name) + '/';
    }

    function getLiveUrl(repo) {
        var homepage = sanitizeHomepage(repo.homepage);
        if (homepage) {
            return homepage;
        }
        if (repo.has_pages) {
            return pagesUrl(repo);
        }
        return '';
    }

    function shouldInclude(repo) {
        if (!repo || SKIP_REPOS[repo.name]) {
            return false;
        }

        var liveUrl = getLiveUrl(repo);
        if (!liveUrl) {
            return false;
        }

        if (repo.fork) {
            var homepage = sanitizeHomepage(repo.homepage);
            return !!(homepage && OWN_HOSTS[homepageHost(homepage)]);
        }

        return true;
    }

    function sortByPushedAt(a, b) {
        return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime();
    }

    function fetchReposPage(page) {
        var url = 'https://api.github.com/users/' + USER +
            '/repos?per_page=100&sort=updated&type=owner&page=' + page;

        return fetch(url, {
            headers: {
                'Accept': 'application/vnd.github+json'
            }
        }).then(function (response) {
            if (response.status === 403) {
                throw new Error('GitHub rate limit reached. Please try again in a few minutes.');
            }
            if (!response.ok) {
                throw new Error('GitHub returned ' + response.status + '.');
            }
            return response.json();
        });
    }

    function fetchAllRepos() {
        var all = [];
        var page = 1;

        function next() {
            return fetchReposPage(page).then(function (repos) {
                if (!Array.isArray(repos)) {
                    throw new Error('Unexpected response from GitHub.');
                }
                all = all.concat(repos);
                if (repos.length < 100) {
                    return all;
                }
                page += 1;
                return next();
            });
        }

        return next();
    }

    function renderCard(repo) {
        var liveUrl = getLiveUrl(repo);
        var description = repo.description || 'No description provided.';
        var language = repo.language ? '<span class="gh-badge">' + escapeHtml(repo.language) + '</span>' : '';
        var pagesBadge = repo.has_pages ? '<span class="gh-badge gh-badge-pages">GitHub Pages</span>' : '';

        return (
            '<article class="gh-card">' +
                '<h3>' + escapeHtml(repo.name.replace(/-/g, ' ')) + '</h3>' +
                '<p>' + escapeHtml(description) + '</p>' +
                '<div class="gh-meta">' + language + pagesBadge + '</div>' +
                '<div class="gh-actions">' +
                    '<a class="button gh-live" href="' + escapeHtml(liveUrl) + '" target="_blank" rel="noopener noreferrer">' +
                        '<i class="fas fa-external-link-alt"></i> Live Site' +
                    '</a>' +
                    '<a class="button gh-repo" href="' + escapeHtml(repo.html_url) + '" target="_blank" rel="noopener noreferrer">' +
                        '<i class="fab fa-github"></i> GitHub' +
                    '</a>' +
                '</div>' +
            '</article>'
        );
    }

    function showStatus(el, message, isError) {
        el.hidden = false;
        el.className = isError ? 'gh-status gh-error' : 'gh-status';
        el.innerHTML = message;
    }

    function hideStatus(el) {
        el.hidden = true;
        el.innerHTML = '';
    }

    function init() {
        var grid = document.getElementById('gh-projects-grid');
        var status = document.getElementById('gh-projects-status');
        var count = document.getElementById('gh-projects-count');

        if (!grid || !status) {
            return;
        }

        showStatus(status, 'Loading public projects from GitHub…', false);

        fetchAllRepos()
            .then(function (repos) {
                var liveProjects = repos.filter(shouldInclude).sort(sortByPushedAt);
                hideStatus(status);

                if (count) {
                    count.textContent = liveProjects.length
                        ? liveProjects.length + ' project' + (liveProjects.length === 1 ? '' : 's') + ' with a public URL'
                        : '';
                }

                if (!liveProjects.length) {
                    showStatus(
                        status,
                        'No public project URLs were found. You can still browse the <a href="' +
                            PROFILE_URL + '" target="_blank" rel="noopener noreferrer">GitHub profile</a>.',
                        false
                    );
                    grid.innerHTML = '';
                    return;
                }

                grid.innerHTML = liveProjects.map(renderCard).join('');
            })
            .catch(function (err) {
                if (count) {
                    count.textContent = '';
                }
                grid.innerHTML = '';
                showStatus(
                    status,
                    escapeHtml(err.message || 'Could not load GitHub projects.') +
                        ' <a href="' + PROFILE_URL + '" target="_blank" rel="noopener noreferrer">View repositories on GitHub</a>.',
                    true
                );
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
