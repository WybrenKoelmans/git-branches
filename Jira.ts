import { existsSync, readFileSync, writeFileSync } from "fs";
import crypto from "crypto";
import debug from "debug";

const log = debug('git-branches:jira');

export class Jira {

  public async getIssues(ids: string[]) {
    const cachePath = this.getCachePath(ids.join());
    // log(ids.join());

    if (existsSync(cachePath)) {
      log('Returning Jira cache.');
      return JSON.parse(readFileSync(cachePath, { encoding: 'utf-8' }));
    }

    const data = await this.getPage(ids);


    writeFileSync(cachePath, JSON.stringify(data));
    log('Wrote Jira cache.');

    return data;
  }

  private getCachePath(input: string) {
    const hash = crypto.createHash('md5').update(input).digest('hex');

    return `/app/cache/jira-${hash}.json`;
  }

  private async getPage(ids:string[], cursor: string|null = null) {
    const response = await fetch("https://skydreams-com.atlassian.net/gateway/api/graphql", {
      "headers": {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9,nl;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        "pragma": "no-cache",
        "x-experimentalapi": "JiraIssueSearch",
        "Authorization": "Basic d3licmVuLmtvZWxtYW5zQHNreWRyZWFtcy5ubDpBVEFUVDN4RmZHRjBleG02VEZfaUdRTlNjd2dYUm50SWVLRDZzT29ESXlsMHFoc29JZm1xd1ZaUUtaZEZpNHFkNTRUc2Z0anFfRDlaVnlYSFIyWG1UNU9zdjZ3NlFoVGxRY1RQSXRjcVV2WU1Tb3hndU1mZlpOYkJTVkVQTVkzbTBUOGJ4VlJEa3Nxci1TLS16UUV1ai1tZ1hzODQtNmlGazNaZVhwb3Fjc0NvZzBVZTlhNEhkX1E9QkRGRTNBMEQ="
      },
      "referrerPolicy": "no-referrer",
      "body": JSON.stringify({
        operationName: 'MyQuery',
        query: `
            query MyQuery {
                jira {
                  issueSearchStable(
                    cloudId: "c6558281-49af-4b8c-84a4-0b7d54136a58"
                    issueSearchInput: {jql: "key in (${ids.join()})"}
                    first: 999
                    after: ${cursor ? `"${cursor}"` : null}
                  ) {
                    pageInfo {
                      endCursor
                      hasNextPage
                    }
                    edges {
                      node { 
                        key
                        webUrl
                        fields {
                          edges {
                            node {
                              name
                              ... on JiraStatusField {
                                status {
                                  name
                                }
                              }
                              ... on JiraSingleLineTextField {
                                text
                              }
                              ... on JiraIssueTypeField {
                                issueType {
                                  name
                                  avatar {
                                    xsmall
                                  }
                                }
                              }
                              ... on JiraParentIssueField {
                                parentIssue {
                                  key
                                  webUrl
                                  fieldsById(ids: ["summary", "issuetype"]) {
                                    edges {
                                      node {
                                        name
                                        ... on JiraSingleLineTextField {
                                          text
                                        }
                                        ... on JiraIssueTypeField {
                                          issueType {
                                            name
                                            avatar {
                                              xsmall
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }`
      }),
      "method": "POST"
    });

    const data = await response.json();
    // access data in safe way
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }
    if (data.data.jira.issueSearchStable.pageInfo.hasNextPage) {
      log('Getting more Jira data.')
      const endCursor = data.data.jira.issueSearchStable.pageInfo.endCursor;
      const nextData = await this.getPage(ids, endCursor);
      data.data.jira.issueSearchStable.edges.push(...nextData.data.jira.issueSearchStable.edges);
      log('Got more Jira data.');
    }

    return data;
  }
}
